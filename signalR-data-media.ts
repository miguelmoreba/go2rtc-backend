import { HttpTransportType, HubConnectionBuilder } from "@microsoft/signalr";
const { RTCVideoSource, RTCVideoSink, rgbaToI420 } =
  require("wrtc").nonstandard;
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from "wrtc";

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
          const iceCandidate = new RTCIceCandidate(JSON.parse(candidate));
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

    const cameraApiChannel =
      peerConnection.createDataChannel("cameraApiChannel");
    cameraApiChannel.onmessage = async (event) => {
      try {
        console.log("THIS IS THE MESSAGE", event.data);
        const response = await fetch(`${CAMERA_API_URL}${event.data}`);
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("text")) {
          const formattedResponse = {
            ok: response.ok,
            data: await response.text(),
          };
          console.log('text response', formattedResponse);
          cameraApiChannel.send(JSON.stringify(formattedResponse));
        } else if (contentType?.includes("JSON")) {
          const formattedResponse = {
            ok: response.ok,
            data: await response.json(),
          };
          cameraApiChannel.send(JSON.stringify(formattedResponse));
        } else if (contentType?.includes("image")) {
          const myBlob = await response.blob();
          console.log(typeof myBlob, myBlob, myBlob instanceof Blob);
          cameraApiChannel.send(await myBlob.arrayBuffer());
        } else if (contentType?.includes("octet-stream")) {
          cameraApiChannel.send(await response.arrayBuffer());
        }
      } catch (e) {
        console.log("ERROR", e);
        cameraApiChannel.send(JSON.stringify({ ok: false }));
      }
    };

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
