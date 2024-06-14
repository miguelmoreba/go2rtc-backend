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
const API_URL = "https://dev-api-vpc.egoscue.com";
const CAMERA_API_URL = "https://localhost";

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
    const piSendChannel = peerConnection.createDataChannel("piSendChannel");
    setInterval(() => setupDataChannel(peerConnection, piSendChannel), 1000);

    const cameraApiChannel = peerConnection.createDataChannel("cameraApiChannel");
    cameraApiChannel.onmessage = async (event) => {
      try{
        // const response = await axios.get(`${API_URL}${event.message.path}`);
        console.log('THIS IS THE MESSAGE', event.data)
        const response = await fetch(`${CAMERA_API_URL}${event.data}`);
        console.log('THIS IS THE RESPONSE', await response.text());
        // cameraApiChannel.send(JSON.stringify(await response.json()));
      } catch (e) {
        console.log('ERROR', e)
        cameraApiChannel.send(JSON.stringify({ok: false}));
      }
    }

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
