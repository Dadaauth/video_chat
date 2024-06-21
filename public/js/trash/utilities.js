import {
    localVideo, stopCallButton, startAudioCallButton,
    startVideoCallButton, remoteVideo, errorElement,
    acceptCallButton, denyCallButton
} from "./document_elements.js";
import { socket } from "./main.js";

export let globals = {
    callType: null, // video or audio
    localStream: null,
}
// const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};
const configuration = null;

var peerConnection;

// const username = prompt("What is your name?");
const username = "Tunde";





export async function printErrorToFrontend(msg) {
    errorElement.textContent = msg;
    errorElement.style.display = "block";
    setTimeout(() => {
        errorElement.style.display = "none";
    }, 10000);
}

export function stopMediaTracks(stream) {
    if (stream) {
        stream.getTracks().forEach((track) => {
            track.stop();
        });
    }
}

export async function getLocalMediaStream(constraints) {
    let localStream = null;
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Gotten Local Stream", localStream);
    } catch(e) {
        console.error("Failed to get user media", e);
        printErrorToFrontend(`Error: Failed to get user media: ${e.message}`);
        stopCall();
    }
    globals.localStream = localStream;
    return localStream;
}

export let constraints = {
    video: {
        width: { ideal: 400 },
        height: { ideal: 250 },
    },
    audio: {
        echoCancellation: true
    }
}

export async function handleIceCandidate(event) {
    console.log("Ice candidate event: ", event);
    if (event.candidate) {
        socket.emit("new ice candidate", {candidate: event.candidate});
    }
}

export async function startVideoCall() {
    console.log("Starting Video Call...");

    // HTML Manipulations
    startVideoCallButton.textContent = "Calling..."; // change to "in-call" when connected
    startVideoCallButton.disabled = true;
    startAudioCallButton.style.display = "none";
    stopCallButton.style.display = "inline-block";

    globals.callType = "video";
    const localStream = await getLocalMediaStream(constraints);
    if (localStream === null) return
    localVideo.srcObject = localStream;
    globals.localStream = localStream;

    socket.emit("call sending", {
        user: {username},
        type: "video",
    });

    socket.on('call denied', () => {
        console.log("Call denied event on the client side.");
        startVideoCallButton.textContent = "Video Call";
        startVideoCallButton.disabled = false;
        startAudioCallButton.style.display = "inline-block";
        stopCallButton.style.display = "none";
        stopMediaTracks(globals.localStream);
        printErrorToFrontend("Call was denied.");
    });

    try {
        peerConnection = new RTCPeerConnection(configuration);
        peerConnection.onicecandidate = handleIceCandidate;
        peerConnection.addStream(globals.localStream);
        // localStream.getTracks().forEach(track => {
        //     peerConnection.addTrack(track, localStream);
        // });
    } catch(e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }

    peerConnection.addEventListener('track', async (event) => {
        const [remoteStream] = event.streams;
        remoteVideo.srcObject = remoteStream;
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.on('call accepted', async () => {
        socket.emit("call offer", {offer, username});
    });

    socket.on("call offer reply", async (data) => {
        console.log("Received call offer reply: ", data);
        if (data.answer) {
            const { answer } = data;
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });
    socket.on("new ice candidate", async (data) => {
        console.log("Received new ice candidate: ", data);
        if (data.candidate) {
            try {
                await peerConnection.addIceCandidate(data.candidate);
            } catch (e) {
                console.error("Error adding received ice candidate: ", e);
            }
        }
    });
    peerConnection.addEventListener("connectionstatechange", event => {
        console.log("connection state change", peerConnection.connectionState);
        if (peerConnection.connectionState === "connected") {
            console.log("Connected to peer");
            // remoteVideo.srcObject = localStream;
        }
    });
}

export async function acceptCall(event) {
    const localStream = await getLocalMediaStream(constraints);
    if (localStream === null) return
    localVideo.srcObject = localStream;
    globals.localStream = localStream;

    console.log("Call accepted");
    denyCallButton.style.display = "none";
    acceptCallButton.style.display = "none";
    startVideoCallButton.textContent = "In Call";
    startAudioCallButton.style.display = "none";

    socket.emit("call accepted");

    try {
        peerConnection = new RTCPeerConnection(configuration);
        peerConnection.onicecandidate = handleIceCandidate;
        peerConnection.addStream(localStream);
    } catch(e) {
        console.log("Error creating RTCPeerConnection  object:", e);
    }

    peerConnection.addEventListener('track', async (event) => {
        const [remoteStream] = event.streams;
        remoteVideo.srcObject = remoteStream;
    });

    socket.on("call offer", async (data) => {
        console.log("Received call offer: ", data);
        const { offer, username } = data;
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("call offer reply", {answer, username});

        socket.on("new ice candidate", async (data) => {
            console.log("Received new ice candidate: ", data);
            if (data.candidate) {
                try {
                    await peerConnection.addIceCandidate(data.candidate);
                } catch (e) {
                    console.error("Error adding received ice candidate: ", e);
                }
            }
        });
        peerConnection.addEventListener("connectionstatechange", event => {
            console.log("connection state change: ", peerConnection.connectionState);
            if (peerConnection.connectionState === "connected") {
                console.log("Connected to peer");
            }
        
        });
    });
}

export function denyCall(event) {
    startVideoCallButton.textContent = "Video Call";
    acceptCallButton.style.display = "none";
    denyCallButton.style.display = "none";
    startAudioCallButton.style.display = "inline-block";

    socket.emit("call denied");
}

export async function receiveVideoCall(caller) {
    console.log("Receiving video call...");
    startVideoCallButton.textContent = `${caller.username} is calling`;
    acceptCallButton.style.display = "inline-block";
    denyCallButton.style.display = "inline-block";

    acceptCallButton.addEventListener('click', acceptCall);
    denyCallButton.addEventListener('click', denyCall);
}

export function startAudioCall() {
    // HTML Manipulations
    startAudioCallButton.textContent = "Calling..."; // change to "in-call" when connected
    startAudioCallButton.disabled = true;
    startVideoCallButton.style.display = "none";
    stopCallButton.style.display = "inline-block";

    const localStream = getLocalMediaStream({video: false, audio: true});
    globals.callType = "audio";
}

export function receiveAudioCall(caller) {
    console.log("Receiving audio call...");
}

export function stopCall() {
    console.log("Stopping call...");
    stopCallButton.style.display = "none";
    if (globals.callType == "video") {
        startAudioCallButton.style.display = "inline-block";
        startVideoCallButton.textContent = "Video Call";
        startVideoCallButton.disabled = false;
    } else if (globals.callType == "audio") {
        startVideoCallButton.style.display = "inline-block";
        startAudioCallButton.textContent = "Audio Call";
        startAudioCallButton.disabled = false;
    }
    // Stop the media devices from working.
    // Do this by stopping all the tracks.
    stopMediaTracks(globals.localStream);
}