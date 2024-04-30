import { HttpTransportType, HubConnectionBuilder } from "@microsoft/signalr";

const API_URL = "https://localhost:5001";

const cameraId = 1;

const go2rtc = "http://localhost:1984";

const signalRConnection = new HubConnectionBuilder()
  .withUrl(`${API_URL}/hubs/v1/depthCameraHub`, {
    withCredentials: false,
    transport: HttpTransportType.WebSockets,
    skipNegotiation: true,
  })
  .build();

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

signalRConnection.start().then(() => console.log("Connected to signalR"));

signalRConnection.on(
  `BrowserRequiresStream-${cameraId}`,
  async (streamName, sessionUuid) => {
    console.log("Browser requires stream");
    let responseBody: any;

    const getResponse = await fetch(
      `${go2rtc}/api/webtorrent?src=${streamName}`,
      {
        method: "GET",
      }
    );

    if (getResponse.status == 200) {
      responseBody = await getResponse.json();
    } else {
      const postResponse = await fetch(
        `${go2rtc}/api/webtorrent?src=${streamName}`,
        {
          method: "POST",
        }
      );

      responseBody = await postResponse.json();
    }

    console.log(responseBody);

    signalRConnection.invoke(
      "PiOffersStream",
      cameraId,
      (responseBody as any).share,
      (responseBody as any).pwd,
      sessionUuid
    );
  }
);
