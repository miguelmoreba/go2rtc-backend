import { HttpTransportType, HubConnectionBuilder } from "@microsoft/signalr";
// import { RTCVideoSink, RTCVideoSource } from "@roamhq/wrtc/types/nonstandard";
const { RTCVideoSource, RTCVideoSink, rgbaToI420 } =
  require("wrtc").nonstandard;
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from "wrtc";

// const API_URL = "https://dev-api-vpc.egoscue.com";
const API_URL = "https://localhost:5001";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.1.google.com:19302", "stun:stun2.1.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

const cameraId = 1;

// const go2rtc = "http://localhost:1984";

const signalRConnection = new HubConnectionBuilder()
  .withUrl(`${API_URL}/hubs/v1/depthCameraHub`, {
    withCredentials: false,
    transport: HttpTransportType.WebSockets,
    skipNegotiation: true,
  })
  .build();

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

const peerConnections = new Map<string, RTCPeerConnection>();

signalRConnection.on(
  `ClientRequiresStream-${cameraId}`,
  async (sessionUuid) => {
    signalRConnection.on(
      `VerifiedAnswer-${sessionUuid}`,
      async (sessionUuid, answer) => {
        console.log(`Got an answer for uuid ${sessionUuid}`);
        const peerConnection = peerConnections.get(sessionUuid);
        const answerDescription = new RTCSessionDescription(JSON.parse(answer));
        await peerConnection?.setRemoteDescription(answerDescription);
      }
    );

    signalRConnection.on(
      `VerifiedIceCandidate-${sessionUuid}`,
      async (sessionUuid, candidate) => {
        console.log("new candidate", candidate, sessionUuid);
        try {
          const peerConnection = peerConnections.get(sessionUuid);
          // Convert the received ICE candidate to RTCIceCandidate
          const iceCandidate = new RTCIceCandidate(JSON.parse(candidate));
          // Add the ICE candidate to the peer connection
          await peerConnection?.addIceCandidate(iceCandidate);
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    );

    console.log("Received requires");
    const peerConnection = new RTCPeerConnection(servers);

    console.log("Peer connection", peerConnection);

    peerConnections.set(sessionUuid, peerConnection);

    const source = new RTCVideoSource();
    const track = source.createTrack();
    const transceiver = peerConnection.addTransceiver(track);
    const sink = new RTCVideoSink(transceiver.receiver.track);

    // Without the creation of this dummy data channel, the connection doesn't work, and I don't have access to the pi channel
    const dataChannel = peerConnection.createDataChannel("piSendChannel");
    setInterval(() => setupDataChannel(peerConnection, dataChannel), 1000);

    // console.log(peerConnection);

    // // Create offer and send it to the Raspberry Pi
    peerConnection.createOffer().then((offer: any) => {
      console.log("Offer created");
      peerConnection.setLocalDescription(offer);
      signalRConnection.invoke("Offer", sessionUuid, JSON.stringify(offer));
    });
  }
);

signalRConnection.start().then(() => console.log("Connected to signalR"));

const setupDataChannel = (peerConnection, dataChannel) => {
  console.log("peerConnection is", peerConnection.connectionState);
  console.log("piSendChannel is", dataChannel.readyState);

  if (dataChannel?.readyState == "open") {
    dataChannel.send(`Counter is 1`);

  }
};
