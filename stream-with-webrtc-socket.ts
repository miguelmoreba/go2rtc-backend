import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from "wrtc";
import io from "socket.io-client";
// import axios from "axios";
import fs from "fs";
import path from "path";
import axios from "axios";
import https from "https";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.1.google.com:19302", "stun:stun2.1.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

let fileNumber = 1;

// Connect to signaling server
const socket = io("https://signalingserver-production-4616.up.railway.app"); // Replace with your signaling server IP and port

const peerConnections = new Map<string, RTCPeerConnection>();

socket.on("browser-connected", async ({ uuid }) => {
  console.log("new browser", uuid);

  // Configure RTCPeerConnection
  const peerConnection = new RTCPeerConnection(servers);

  peerConnections.set(uuid, peerConnection);

  // Without the creation of this dummy data channel, the connection doesn't work, and I don't have access to the pi channel
  const dataChannel = peerConnection.createDataChannel("piSendChannel");

  // Create offer and send it to the Raspberry Pi
  peerConnection.createOffer().then((offer: any) => {
    peerConnection.setLocalDescription(offer);
    console.log(uuid);
    socket.emit("offer", { offer, uuid });
  });

  let messageCounter = 0;

  setInterval(async () => {
    console.log("peerConnection is", peerConnection.connectionState);
    console.log("piSendChannel is", dataChannel.readyState);

    if (dataChannel?.readyState == "open") {
      // dataChannel.send(`Counter is ${messageCounter}`);
      // const image = getImageAsBuffer(fileNumber);
      const image = await getImageFromCamera();
      fileNumber++;

      // dataChannel.send(base64Image);
      dataChannel.send(image);
    }
    messageCounter++;
  }, 120);
});

// Listen for answer from the Raspberry Pi
socket.on("answer", async ({ answer, uuid }) => {
  const peerConnection = peerConnections.get(uuid);
  const answerDescription = new RTCSessionDescription(answer);
  await peerConnection?.setRemoteDescription(answerDescription);
});

socket.on("ice-candidate", async ({ candidate, uuid }) => {
  console.log("new candidate", candidate, uuid);
  try {
    const peerConnection = peerConnections.get(uuid);
    // Convert the received ICE candidate to RTCIceCandidate
    const iceCandidate = new RTCIceCandidate(candidate);
    // Add the ICE candidate to the peer connection
    await peerConnection?.addIceCandidate(iceCandidate);
  } catch (error) {
    console.error("Error adding ICE candidate:", error);
  }
});

const getImage = (imageBuffer: Buffer) => {
  // const imageBuffer = fs.readFileSync(path.join(__dirname, `./images/${color}.png`));
  return imageBuffer.toString("base64");
};

const getImageAsBuffer = (imageName: number) => {
  return fs.readFileSync(path.join(__dirname, `./images/${imageName}.jpeg`));
};

const getImageFromCamera = async () => {
  try {
    const response = await axios.get("https://localhost/capture?shrink=0.1", {
      responseType: "arraybuffer",
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    return Buffer.from(response.data, "binary");
  } catch {
    console.log("THere was some error");
    return new Buffer("");
  }
};


