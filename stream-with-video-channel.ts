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
import Jimp from "jimp";
import sharp from "sharp";
const { RTCVideoSource, RTCVideoSink, rgbaToI420 } = require('wrtc').nonstandard;
const imageSize = require("image-size")

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

  const source = new RTCVideoSource();
  const track = source.createTrack();
  const transceiver = peerConnection.addTransceiver(track);
  const sink = new RTCVideoSink(transceiver.receiver.track);

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
      // dataChannel.send(image);

      if (image === null){
        return;
      }

      console.time(`Processing_time_${fileNumber}`)
      console.time(`ImageSize_${fileNumber}`);
      const {height, width} = imageSize(image);
      console.timeEnd(`ImageSize_${fileNumber}`);

      console.time(`Sharp_${fileNumber}`)
      const { data, info } = await sharp(image)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });
      console.timeEnd(`Sharp_${fileNumber}`);
    
      const rgbaData = new Uint8ClampedArray(data);
      const i420Data = new Uint8ClampedArray(width * height * 1.5);
      const rgbaFrame = { width: width, height: height, data: rgbaData };
      const i420Frame = { width: width, height, data: i420Data };

      rgbaToI420(rgbaFrame, i420Frame);

      source.onFrame(i420Frame);
      console.log("Is sent");
      console.timeEnd(`Processing_time_${fileNumber}`)
    }
    messageCounter++;
  }, 70);
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
    console.time(`Call_to_camera_${fileNumber}`);
    const response = await axios.get("https://localhost/capture?shrink=0.3", {
      responseType: "arraybuffer",
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
    console.timeEnd(`Call_to_camera_${fileNumber}`)

    return Buffer.from(response.data, "binary");
  } catch {
    console.log("There was some error");
    return null;
  }
};
