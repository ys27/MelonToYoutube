# MelonList
Crawls and parses the Melon charts and creates private Youtube Playlists.

After signing in and generating a playlist, enjoy your custom playlists on Youtube, Youtube Music, and Spotify (upcoming).

You need to add a client/src/config.json in this format:

```
{
    "redirectUri": "",
    "clientId": "",
    "secret": ""
}
```

Set the redirect uri to your site uri. e.g. `http://localhost:3000`
Set the client id and secret for your Google API.

To run:

1. make sure mongo is running in the background.
2. execute `npm start` in the server folder.
3. execute `npm start` for development and `npm build` for production (static dist from webpack) in the client folder.
