import { PeerConnect, MediaControl, Call, SignallingChannel,  } from "./models.js";
import {
    startVideoCallButton,
    startAudioCallButton,
    acceptCallButton,
    denyCallButton,
    stopCallButton,
    localVideo,
    remoteVideo,
    errorElement,
    usersToCallSelectUI,
    displayUserId
} from './document_elements.js';
import { signallingChannel } from "./models.js";
import { changeFrontendUi } from "./utils.js";

let username = "";
while (username === "") username = prompt("Please enter your username:");
let user = {username};
let call;

signallingChannel.send("new client", username);
signallingChannel.receive("your info", (socketId) => {
    user["socketId"] = socketId;
    displayUserId.textContent = `Your Call Id is [${user.username} - ${user.socketId}]`;
    call = new Call(null, user);
});
signallingChannel.receive("clients state change", (data) => {
    if (!data.users) return;
    data['user'] = user;
    changeFrontendUi({type: "clients state change", data});
});

startVideoCallButton.addEventListener("click", async (e) => {
    let peerId = usersToCallSelectUI.value;
    call.callType = "video";
    await call.startCall(peerId);
});

startAudioCallButton.addEventListener('click', async (e) => {
    let peerId = usersToCallSelectUI.value;
    call.callType = "audio";
    await call.startCall(peerId);
});


stopCallButton.addEventListener('click', e => {
    console.log("Stopping call...");
    call.stopCall({endCallInitiator: true});
});