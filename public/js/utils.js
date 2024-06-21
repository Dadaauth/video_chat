import {
    acceptCallButton, callStatus, denyCallButton,
    errorElement, localVideo, remoteVideo, startAudioCallButton, startVideoCallButton,
    stopCallButton, 
    usersToCallSelectUI, 
    videoInlineContainer
} from "./document_elements.js";


export async function printErrorToFrontend(msg) {
    errorElement.textContent = msg;
    errorElement.style.display = "block";
    setTimeout(() => {
        errorElement.style.display = "none";
    }, 10000);
}

export function changeFrontendUi(effect) {
    if (effect.type === "start call") {
        callStatus.textContent = "Calling...";
        callStatus.style.display = "inline-block";
        startVideoCallButton.style.display = "none";
        startAudioCallButton.style.display = "none";
        stopCallButton.style.display = "inline-block";
    } else if (effect.type === "end call") {
        callStatus.textContent = "Call ended.";
        setTimeout(() => {callStatus.style.display = "none"}, 5000);
        stopCallButton.style.display = "none";
        startVideoCallButton.style.display = "inline-block";
        startAudioCallButton.style.display = "inline-block";
        remoteVideo.srcObject = null;
        localVideo.srcObject = null;
        videoInlineContainer.style.display = "none";
    } else if (effect.type === "call connected") {
        callStatus.textContent = "Connected";
        callStatus.style.display = "inline-block";
    } else if (effect.type === "call denied") {
        startVideoCallButton.style.display = "inline-block";
        startAudioCallButton.style.display = "inline-block";
        acceptCallButton.style.display = "none";
        denyCallButton.style.display = "none";
        stopCallButton.style.display = "none";
        callStatus.style.display = "none";
    } else if (effect.type === "call accepted") {
        callStatus.textContent = "Connecting...";
        startVideoCallButton.style.display = "none";
        startAudioCallButton.style.display = "none";
        acceptCallButton.style.display = "none";
        denyCallButton.style.display = "none";
        stopCallButton.style.display = "inline-block";
    } else if (effect.type === "reset") {
    } else if (effect.type === "call incoming") {
        callStatus.textContent = `Incoming Call from ${effect.data.caller.username} - ${effect.data.caller.socketId}`;
        callStatus.style.display = "inline-block";
        startVideoCallButton.style.display = "none";
        startAudioCallButton.style.display = "none";
        acceptCallButton.style.display = "inline-block";
        denyCallButton.style.display = "inline-block";
    } else if (effect.type === "clients state change") {

        let users = effect.data.users;
        let currentUser = effect.data.user;
        usersToCallSelectUI.innerHTML = "";
        let option;
        users.forEach(user => {
            console.log(users);
            if (user.socketId === currentUser.socketId) return;
            option = document.createElement("option");
            option.value = `${user.socketId}`;
            option.textContent = `${user.username} - ${user.socketId}`;
            usersToCallSelectUI.appendChild(option);
        });
    }
    ///////////////////////////////////

    if (!effect.specific) return;
    if (effect.specific === "video-call") {
        videoInlineContainer.style.display = "flex";
    } else if (effect.specific === "audio-call") {
    }
}