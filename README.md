# Galaxy TV

Cross-platform IPTV client for Android, iOS, and Android TV devices. After activation, LIVE loads packages on demand and downloads channels only for the selected package. SPORTS scans packages sequentially, retaining only channels with sports names or channels from sports packages.

The mobile app is in `mobile/` and connects directly to `http://gean4563t.xyz:80/V6/API-V6.php`. It sends XOR-encrypted, Base64-encoded multipart requests and decrypts the binary XOR response. The direct connection requires the XOR key in the app build, where it can be extracted. The endpoint uses plain HTTP, so XOR does not protect request data against network interception.

## Optional proxy service

The standalone proxy in `server/` keeps the XOR key on the server, but the mobile app is currently configured for direct API access. To run the proxy, copy `server/.env.example` to `server/.env` and set `IPTV_XOR_KEY` locally. Do not commit `.env`.

```sh
cd server
npm test
npm start
```

## Run the app

Copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_XOR_KEY` to the provider's XOR key before building or starting the app. The `.env` file is git-ignored. Expo embeds `EXPO_PUBLIC_*` values in the app bundle, so this key is extractable from a distributed app.

```sh
cd mobile
npm install
npx expo start
```

Sign-in activates the device once through the `active` mode. After activation, the SAT2IPTV tab loads available satellite-to-IPTV channels through `sat2iptv`. MOVIES loads ordered categories through `movies_cat`, requests a list with `movies_list` using the selected `sub_id`, then gets details through `movies_info`. SERIES loads categories with `series_cat`, lists titles through `series_list`, and requests seasons and episodes with `series_info`. SETTINGS shows remaining subscription duration and clears local credentials on logout. Android TV builds include the Leanback launcher category and focusable controls for a remote. iOS builds require macOS or an EAS build service.