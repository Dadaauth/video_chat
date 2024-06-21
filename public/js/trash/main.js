import {
    receiveAudioCall,
    receiveVideoCall,
    startAudioCall,
    startVideoCall, stopCall 
} from "./utilities.js";
import {
     stopCallButton, startVideoCallButton, startAudioCallButton
} from "./document_elements.js";


export const socket = io();



startVideoCallButton.addEventListener("click", (e) => {
    startVideoCall();
});

socket.on("call arrival", (data) => {
    console.log("socket.io event indicating arrival of a call.");
    const caller = data.user;
    const callType = data.type;

    callType == "video"? receiveVideoCall(caller) : receiveAudioCall(caller);
});

stopCallButton.addEventListener("click", (e) => {
    // perform necessary steps needed to stop the call
    stopCall();
});