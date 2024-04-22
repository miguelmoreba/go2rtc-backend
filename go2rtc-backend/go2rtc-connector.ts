import io from "socket.io-client";

const socket = io("https://signalingserver-production-4616.up.railway.app");

const go2rtc = "http://localhost:1984";

const cameraId = 1;

socket.on(`browser-requires-stream-${cameraId}`, async ({streamName}) => {

  console.log('ooooiii')

  let responseBody: any;

  const getResponse = await fetch(`${go2rtc}/api/webtorrent?src=${streamName}`, {
    method: "GET",
  });

  if (getResponse.status == 200){
    responseBody = await getResponse.json();
  } else {
    const postResponse = await fetch(`${go2rtc}/api/webtorrent?src=${streamName}`, {
      method: "POST"
    });

    responseBody = await postResponse.json();
  }

  console.log(responseBody);

  socket.emit(`pi-offers-stream`, {
    cameraId,
    share: (responseBody as any).share,
    pwd: (responseBody as any).pwd,
  });
});
