[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

![node](https://img.shields.io/node/v/homebridge-daikin-tempsensor-nocloud)
[![npm](https://img.shields.io/npm/dt/homebridge-daikin-tempsensor-nocloud.svg)](https://www.npmjs.com/package/homebridge-daikin-tempsensor-nocloud)
[![npm](https://img.shields.io/npm/l/homebridge-daikin-tempsensor-nocloud.svg)](https://github.com/cbrandlehner/homebridge-daikin-tempsensor-nocloud/blob/master/LICENSE)
[![npm version](https://badge.fury.io/js/homebridge-daikin-tempsensor-nocloud.svg)](https://badge.fury.io/js/homebridge-daikin-tempsensor-nocloud)

![Node.js CI](https://github.com/cbrandlehner/homebridge-daikin-tempsensor-nocloud/workflows/Node.js%20CI/badge.svg)
![CodeQL](https://github.com/cbrandlehner/homebridge-daikin-tempsensor-nocloud/workflows/CodeQL/badge.svg)
# homebridge-daikin-tempsensor-nocloud

Supports Daikin Air Conditioners on [HomeBridge](https://github.com/nfarina/homebridge) by connecting to the optional [Daikin Wifi Controller](https://amzn.to/2MZDQjg) or by using the builtin wifi controller that comes with some models.


<img src="https://user-images.githubusercontent.com/2294359/80783655-abb6c200-8ba4-11ea-9b60-d5823e3b788f.jpeg" align="center" alt="controller" style="transform:rotate(90deg);" width="50%" height="50%">

<img src="https://user-images.githubusercontent.com/2294359/80783675-b4a79380-8ba4-11ea-9fa8-f48f9bf12585.jpeg" align="center" alt="controller" width="50%" height="50%">



# Installation

This plugin retrieves sensor and mode data from a [Daikin WIFI controller](https://amzn.to/2MZDQjg) in your local network and allows you to set operation modes and target temperatures. As it is a plugin for [HomeBridge](https://github.com/nfarina/homebridge) you will have access to this features using Apple Home.

The install may require you to run as an administrator (using a different login or sudo).
It is recommended to configure your DHCP server to reserve an IP for the wifi controller.
This plugin can be installed using the [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x#readme) or manually by following these steps:

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-daikin-tempsensor-nocloud
3. Update your configuration file. See sample-config.json in this repository for a sample.


# Configuration

This screenshot shows the configuration in [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x#readme):

<img src="https://user-images.githubusercontent.com/10800971/104128327-4b993200-5367-11eb-9ee2-70cd2fb4311f.png" align="center" alt="configuration" width="50%" height="50%">

Users are advised to use the graphical configuration. In case you configure the setings manually, please make sure to check the file config.schema.json first to understand the settings and possible values.

# Technical background information on the API being used

The `apiroute` is used for two main calls: Get info such as current activity and sensor readings from the thermostat and set the target temperature and modes. The Aircon LAN adapter provides two directories for these settings and data:

1. `/common` uses the GET method for control and system information about the Aircon (e.g software version, MAC address, Reboot System, Region)

2. `/aircon` uses the GET method to set Aircon related information (e.g Target Temperature, Modes like Heat and Cool, Temperature Sensor Readings, Timers)

# Supported devices

Currently, this plugin supports Daikin wifi controllers supporting the "aircon" URLs (System: Default) and "skyfi" URLs (System: Skyfi).

To test `http` connectivity, use your browser to connect to your device using one of these URLs:
 ```
http://192.168.1.88/aircon/get_model_info
http://192.168.1.88/skyfi/aircon/get_model_info
 ```
replace the IP (192.168.1.88) with the IP of your device.

Your browser should return a line like this:
 ```
ret=OK,model=0AB9,type=N,pv=2,cpv=2,cpv_minor=00,mid=NA,humd=0,s_humd=0,acled=0,land=0,elec=0,temp=1,temp_rng=0,m_dtct=1,ac_dst=--,disp_dry=0,dmnd=0,en_scdltmr=1,en_frate=1,en_fdir=1,s_fdir=3,en_rtemp_a=0,en_spmode=0,en_ipw_sep=0,en_mompow=0
 ```
If it does not, your device is not yet supported.

To test `https` connectivity see [HTTPS/Registered client support](#https-registered-client)

The response of an usupported device will look like this:
 ```
ret=PARAM NG,msg=404 Not Found
 ```

## HTTPS/Registered client support<a id="https-registered-client"></a>

Some models require requests via `https` containing a registered client token.

It is necessary to register a client token with each device.
The same token may be registered with multiple devices.

These instructions are based on comments in [GitHub Project ael-code/daikin-control Issue #27](https://github.com/ael-code/daikin-control/issues/27)

1. Generate a UUID4 (https://www.uuidgenerator.net can be used), _e.g._ `7b9c9a47-c9c6-4ee1-9063-848e67cc7edd`
2. Strip the `-` from the UUID, _i.e._ `7b9c9a47c9c64ee19063848e67cc7edd`
3. Grab the 13-digit key from the sticker on the back of the controller. _e.g._ `0123456789012`
4. Register the UUID as a client token
```
curl --insecure -H "X-Daikin-uuid: 7b9c9a47c9c64ee19063848e67cc7edd" -v "https://<controller-ip>/common/register_terminal?key=0123456789012"
```

This UUID must be used in client requests to the device.

Test your registered token using the above requests but using `https` instead of `http`, _e.g._
```
curl --insecure -H "X-Daikin-uuid: 7b9c9a47c9c64ee19063848e67cc7edd" -v "https://192.168.1.88/aircon/get_model_info"
curl --insecure -H "X-Daikin-uuid: 7b9c9a47c9c64ee19063848e67cc7edd" -v "https://192.168.1.88/skifi/aircon/get_model_info"
```

In the configuration file, make sure you specify `https` in the `apiroute` option
and add the registered token as the value of `uuid` in the configuration for _each_ device, _e.g._
```
        "accessories": [
            {
                "accessory": "Daikin-Local",
                "name": "Living room",
                "apiroute": "https://192.168.1.50",
                "uuid": "7b9c9a47c9c64ee19063848e67cc7edd",
                "system": "Default",
                "swingMode": "2",
                "defaultMode": "0",
                "fanMode": "FAN",
                "fanName": "Living room FAN"
            }
        ],
```
Make sure to use the correct token if a different token has been registered with each device.

# Debugging and Testing

This plugins code makes heavy use of debug output. Normally, this debug output is not visible on the [homebridge](https://github.com/nfarina/homebridge) console.
As explained in the [Homebridge troubleshooting documentation](https://github.com/nfarina/homebridge/wiki/Basic-Troubleshooting) you should start [homebridge](https://github.com/nfarina/homebridge) like this to see the debug output:

```
homebridge -D
```

For even more debug, use this:

```
DEBUG=* homebridge -D
```
