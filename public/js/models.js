import { changeFrontendUi, printErrorToFrontend } from "./utils.js";
import { acceptCallButton, callStatus, denyCallButton, localVideo, remoteAudio, remoteVideo } from "./document_elements.js";


export class SignallingChannel {
    constructor(type) {
        this.signalEngine = type? type : 'socket.io';
        if (this.signalEngine == 'socket.io') {
            this.socket = io();
        }
    }

    send(event, data) {
        if (this.signalEngine === "socket.io") {
            this.socket.emit(event, data);
        }
    }

    receive(event, callback) {
        if (this.signalEngine === "socket.io") {
            this.socket.on(event, callback);
        }

    }
}

export const signallingChannel = new SignallingChannel();

export class PeerConnect {
    constructor(configuration, callType) {
        let conf = configuration !== undefined? configuration : {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};
        this.peerConn = new RTCPeerConnection(conf);
        this.peerConn.onicecandidate = this.handleIceCandidateDiscovery.bind(this);
        this.signallingChannel = signallingChannel;
        this.callType = callType;
        this.privateRoom;
        this.setUp();
    }

    async setUp() {
        this.signallingChannel.receive("ice candidate from peer", this.handleRemoteIceCandidateDiscovery.bind(this));
        this.signallingChannel.receive("call offer reply", this.handleCallOfferReply.bind(this));
        this.signallingChannel.receive("call offer", this.handleCallOffer.bind(this));
        this.peerConn.addEventListener('track', this.handleTrackEventFromRemote.bind(this));
        this.peerConn.addEventListener('connectionstatechange', this.handleConnectionStateChange.bind(this));
    }

    addLocalStream(stream) {
        this.peerConn.addStream(stream);
    }

    async handleConnectionStateChange(event) {
        if (this.peerConn.connectionState === "connected") {
            console.log("Connected to peer!");
            changeFrontendUi({type: "call connected"});
        }
    }

    async handleTrackEventFromRemote(event) {
        const [remoteStream] = event.streams;
        if (this.callType === "video") remoteVideo.srcObject = remoteStream;
        else if (this.callType === "audio") remoteAudio.srcObject = remoteStream;
    }

    async attemptConnect(isInitiator) {
        if (isInitiator) this.createAndSendOffer();
        // else this.createAndSendAnswer(); might not be necessary. an answer should only be sent when an offer is received
    }

    async createAndSendOffer() {
        const offer = await this.peerConn.createOffer();
        await this.peerConn.setLocalDescription(offer);
        this.signallingChannel.send("call offer", {room: this.privateRoom, offer});
        return offer;
    }

    async handleCallOffer(data) {
        if (data.offer) {
            this.setRemoteSessionDescription(data.offer);
        }
        console.log("Call offer received: ", data.offer);
        this.createAndSendAnswer();
    }

    async handleCallOfferReply(data) {
        if (data.answer) {
            this.setRemoteSessionDescription(data.answer);
        }
        console.log("Call offer reply received: ", data.answer);
    }

    async createAndSendAnswer() {
        const answer = await this.peerConn.createAnswer();
        console.log("Answer sending", answer);
        await this.peerConn.setLocalDescription(answer);
        this.signallingChannel.send("call offer reply", {answer, room: this.privateRoom});
        return answer;
    }
    
    async setRemoteSessionDescription(description) {
        await this.peerConn.setRemoteDescription(new RTCSessionDescription(description));
    }

    async addIceCandidate(candidate) {
        await this.peerConn.addIceCandidate(candidate);
    }

    async handleIceCandidateDiscovery(event) {
        console.log("Ice candidate discovered", event);
        if (event.candidate) {
            this.signallingChannel.send('ice candidate from peer', {candidate: event.candidate, room: this.privateRoom});
        }
    }

    async handleRemoteIceCandidateDiscovery(data) {
        if (data.candidate) {
            try {
                await this.addIceCandidate(data.candidate);
            } catch(e) {
                console.log("Error adding received ice candidate: ", e);
            }
        }
    }
}


export class Call {
    constructor(callType, user) {
        this.callType = callType;
        this.signallingChannel = signallingChannel;
        this.peerConnect = new PeerConnect(null, callType);
        this.isInitiator = false;
        this.user = user;
        this.privateRoom;
        this.setUp();
    }

    async setUp()  {
        this.signallingChannel.receive("call request", this.receiveCall.bind(this));
        this.signallingChannel.receive("call reply", this.callAcceptedOrDenied.bind(this));
        this.signallingChannel.receive("end call", this.stopCall.bind(this));
    }

    async startCall(peerId) {
        if (this.callType === "video") {
            await this.startVideoCall(peerId);
        } else if (this.callType === "audio") {
            await this.startAudioCall(peerId);
        } else {
            console.log("Invalid call type. Cannot start call!");
        }
    }

    async startAudioCall(peerId) {
        console.log("Starting audio call...");
        this.callType = "audio";
        this.peerConnect.callType = "audio";
        ///////////////////////////////////// retrieve media stream
        if (! await this.initializeLocalMediaStream({audio: {echoCancellation: true}})) return;
        this.isInitiator = true;
        ///////////////////////////////////////////

        //////////////////////////////////////////////
        changeFrontendUi({type: "start call", specific: "audio-call"});
        this.privateRoom = `private call ${this.user.socketId} - ${peerId}`;
        this.peerConnect.privateRoom = this.privateRoom;
        this.signallingChannel.send("calling", {
            caller: this.user,
            receipient: {id: peerId},
            type: "audio",
            privateRoom: this.privateRoom,
        });
        // remaining implementations in where the call was accepted
        //////////////////////////////
    }

    async startVideoCall(peerId) {
        console.log("Starting video call...");
        this.callType = "video";
        this.peerConnect.callType = "video";
        ///////////////////////////////////// retrieve media stream
        if (! await this.initializeLocalMediaStream({video: true, audio: {echoCancellation: true}})) return;
        this.isInitiator = true;
        ///////////////////////////////////////////

        //////////////////////////////////////////////
        changeFrontendUi({type: "start call", specific: "video-call"});
        this.privateRoom = `private call ${this.user.socketId} - ${peerId}`;
        this.peerConnect.privateRoom = this.privateRoom;
        this.signallingChannel.send("calling", {
            caller: this.user,
            receipient: {id: peerId},
            type: "video",
            privateRoom: this.privateRoom,
        });
        // remaining implementations in where the call was accepted
        //////////////////////////////
    }

    async receiveCall(data) {
        console.log(`Incoming Call from ${data.caller.username} - ${data.caller.socketId}`);
        this.callType = data.type;
        this.peerConnect.callType = data.type;
        changeFrontendUi({type: "call incoming", data});
        acceptCallButton.addEventListener('click', e => this.acceptOrDenyCall(true, data));
        denyCallButton.addEventListener('click', e => this.acceptOrDenyCall(false, data));
    }

    async initializeLocalMediaStream(constraints) {
        this.mediaControl = new MediaControl(constraints);
        if (! await this.mediaControl.getLocalMediaStream()) {
            console.log("Call failed");
            return false;
        }
        console.log("Gotten local media stream....");
        if (this.callType === "video") localVideo.srcObject = this.mediaControl.localStream;
        console.log(this.mediaControl.localStream);
        this.peerConnect.addLocalStream(this.mediaControl.localStream);
        return true;
    }

    async acceptOrDenyCall(accepted, data) {
        this.privateRoom = data.privateRoom;
        this.peerConnect.privateRoom = this.privateRoom;
        if (!accepted) {
            changeFrontendUi({type: "call denied"});
            this.signallingChannel.send("call reply", {call: {rejected: true, room: this.privateRoom}});
            return;
        }
        this.signallingChannel.send("join private call room", this.privateRoom);
        let constraints;
        constraints = this.callType === "video"? {
            video: true,
            audio: {
                echoCancellation: true,
            }
        } : this.callType === "audio" ? {audio: { echoCancellation: true }} : null;
        if (! await this.initializeLocalMediaStream(constraints)) return;
        changeFrontendUi({type: "call accepted", specific: this.callType === "video"? "video-call": this.callType === "audio"? "audio-call" : ""});
        this.signallingChannel.send("call reply", {call: {accepted: true, room: this.privateRoom}});
    }

    async callAcceptedOrDenied(data) {
        if (data.call.accepted) {
            changeFrontendUi({type: "call accepted"});
            console.log("Call accepted");
            await this.peerConnect.attemptConnect(true);
        } else if (data.call.rejected) {
            this.signallingChannel.send("leave private call room", this.privateRoom);
            changeFrontendUi({type: "call denied"});
            printErrorToFrontend("Call was denied.");
            this.stopCall("call rejected");
        }
    }

    // you still need to cancel the connection when
    // the call gets stopped by the user. The remote peer should be
    // notified and the call should be cancelled on both ends
    stopCall(data) {
        // use the reason argument to stop services based
        // on the stage where the call was stopped.
        this.mediaControl.stopMediaTracks();
        changeFrontendUi({type: "end call"});
        console.log("Stopping the call");
        if (data? data.endCallInitiator: false) this.signallingChannel.send("end call");
        this.isInitiator = false;
    }
}

export class MediaControl {
    constructor(constraints) {
        this.constraints = constraints;
        this.localStream;
    }

    async getLocalMediaStream(constraints) {
        let ctr = constraints? constraints : this.constraints;
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(ctr);
        } catch(e) {
            console.error("Failed to get user media", e);
            printErrorToFrontend(`Error: Failed to get user media: ${e.message}`);
            return false;
        }
        return true;
    }

    stopMediaTracks() {
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                track.stop();
            });
        }
    }
}
class Video {
    constructor() {

    }
}

class Audio {
    constructor() {

    }
}