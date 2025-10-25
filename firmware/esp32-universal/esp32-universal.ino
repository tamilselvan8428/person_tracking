/*
  ESP32 Universal Tracker Firmware
  - Modes:
    - room: BLE advertise name as "ROOM:<device_uid>"
    - person: scans BLE for names starting with "ROOM:", selects strongest RSSI, posts update
  - WiFi + HTTP to backend:
    - GET  /api/devices/config?deviceId=<device_uid>
    - POST /api/devices/heartbeat { device_uid }
    - POST /api/tracking/update { person_device_uid, room_device_uid, rssi, ts }

  Notes:
    - Set WIFI_SSID and WIFI_PASS below.
    - Register devices in the web app with their device_uid (printed on boot) and set type & name.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <NimBLEDevice.h>

// ====== CONFIG ======
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* API_BASE  = "http://192.168.1.100:3001/api"; // change to your backend host
const uint32_t HEARTBEAT_SEC = 60;
const uint32_t TRACK_SEC = 300; // 5 minutes

// ====== STATE ======
String deviceUid;
String deviceType = "person"; // default, will be overwritten by config if available

unsigned long lastHeartbeat = 0;
unsigned long lastTrack = 0;

// ====== HELPERS ======
String getChipId() {
  uint64_t chipid = ESP.getEfuseMac();
  char buf[17];
  snprintf(buf, sizeof(buf), "%04X%08X", (uint16_t)(chipid>>32), (uint32_t)chipid);
  return String(buf);
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  uint8_t tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connect failed");
  }
}

bool httpGet(const String& url, String& bodyOut) {
  ensureWifi();
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(url);
  int code = http.GET();
  if (code > 0) {
    bodyOut = http.getString();
    http.end();
    return code == 200;
  }
  http.end();
  return false;
}

bool httpPostJson(const String& url, const String& json, int* codeOut = nullptr) {
  ensureWifi();
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);
  if (codeOut) *codeOut = code;
  http.end();
  return code >= 200 && code < 300;
}

void fetchConfig() {
  String url = String(API_BASE) + "/devices/config?deviceId=" + deviceUid;
  String body;
  if (httpGet(url, body)) {
    // Very simple parse: search for \"type\":\"room\" or \"person\"
    if (body.indexOf("\"type\":\"room\"") >= 0) deviceType = "room";
    else if (body.indexOf("\"type\":\"person\"") >= 0) deviceType = "person";
    Serial.print("Config fetched, type="); Serial.println(deviceType);
  } else {
    Serial.println("Config fetch failed or not registered yet");
  }
}

void postHeartbeat() {
  String url = String(API_BASE) + "/devices/heartbeat";
  String payload = String("{\"device_uid\":\"") + deviceUid + "\"}";
  int code = 0;
  bool ok = httpPostJson(url, payload, &code);
  Serial.print("Heartbeat "); Serial.print(ok ? "OK" : "FAIL"); Serial.print(" (code="); Serial.print(code); Serial.println(")");
}

// ====== ROOM MODE (BLE ADVERTISE) ======
NimBLEAdvertising* pAdvertising = nullptr;

void startRoomAdvertise() {
  NimBLEDevice::init("");
  pAdvertising = NimBLEDevice::getAdvertising();
  String name = String("ROOM:") + deviceUid;
  NimBLEAdvertisementData advData;
  advData.setName(name.c_str());
  pAdvertising->setAdvertisementData(advData);
  pAdvertising->start();
  Serial.print("Advertising as "); Serial.println(name.c_str());
}

// ====== PERSON MODE (BLE SCAN) ======
class RoomAdvertisedDeviceCallbacks: public NimBLEAdvertisedDeviceCallbacks {
  public:
    NimBLEAdvertisedDevice strongest;
    int strongestRssi = -999;
    void onResult(NimBLEAdvertisedDevice* advertisedDevice) override {
      if (advertisedDevice->haveName()) {
        String n = advertisedDevice->getName().c_str();
        if (n.startsWith("ROOM:")) {
          int rssi = advertisedDevice->getRSSI();
          if (rssi > strongestRssi) {
            strongest = *advertisedDevice;
            strongestRssi = rssi;
          }
        }
      }
    }
};

bool scanNearestRoom(String &roomUidOut, int &rssiOut) {
  NimBLEDevice::init("");
  NimBLEScan* pScan = NimBLEDevice::getScan();
  RoomAdvertisedDeviceCallbacks* cb = new RoomAdvertisedDeviceCallbacks();
  pScan->setAdvertisedDeviceCallbacks(cb);
  pScan->setActiveScan(true);
  NimBLEScanResults results = pScan->start(5, false);
  (void)results;
  if (cb->strongestRssi == -999) {
    delete cb;
    Serial.println("No ROOM beacons found");
    return false;
  }
  String name = cb->strongest.getName().c_str();
  int strongestRssi = cb->strongestRssi;
  delete cb;
  // name format ROOM:<uid>
  String s = String(name.c_str());
  int colon = s.indexOf(':');
  if (colon > 0) {
    roomUidOut = s.substring(colon+1);
    rssiOut = strongestRssi;
  }
  return true;
}

bool scanNearestRoom2(String &roomUidOut, int &rssiOut) {
  NimBLEDevice::init("");
  NimBLEScan* pScan = NimBLEDevice::getScan();
  RoomAdvertisedDeviceCallbacks cb;
  pScan->setAdvertisedDeviceCallbacks(&cb);
  pScan->setActiveScan(true);
  pScan->start(5, false);
  if (cb.strongestRssi == -999) {
    Serial.println("No ROOM beacons found");
    return false;
  }
  String name = cb.strongest.getName().c_str();
  String s = String(name.c_str());
  int colon = s.indexOf(':');
  if (colon > 0) {
    roomUidOut = s.substring(colon+1);
    rssiOut = cb.strongestRssi;
    return true;
  }
  return false;
}

void postTracking(const String& roomUid, int rssi) {
  String url = String(API_BASE) + "/tracking/update";
  unsigned long ms = millis();
  String payload = String("{\"person_device_uid\":\"") + deviceUid + "\",\"room_device_uid\":\"" + roomUid + "\",\"rssi\":" + String(rssi) + ",\"ts\":" + String((unsigned long)(millis())) + "}";
  int code = 0;
  bool ok = httpPostJson(url, payload, &code);
  Serial.print("Tracking "); Serial.print(ok ? "OK" : "FAIL"); Serial.print(" (code="); Serial.print(code); Serial.println(")");
}

// ====== SETUP/LOOP ======
void setup() {
  Serial.begin(115200);
  delay(500);
  deviceUid = getChipId();
  Serial.print("Device UID: "); Serial.println(deviceUid);
  ensureWifi();
  fetchConfig();

  if (deviceType == "room") {
    startRoomAdvertise();
  } else {
    // person mode: nothing now, will scan periodically
  }
}

void loop() {
  unsigned long now = millis();

  // Heartbeat every HEARTBEAT_SEC
  if (now - lastHeartbeat >= HEARTBEAT_SEC * 1000UL) {
    postHeartbeat();
    lastHeartbeat = now;
  }

  if (deviceType == "person") {
    if (now - lastTrack >= TRACK_SEC * 1000UL) {
      String roomUid; int rssi = 0;
      if (scanNearestRoom2(roomUid, rssi)) {
        postTracking(roomUid, rssi);
      }
      lastTrack = now;
    }
  }

  delay(100);
}
