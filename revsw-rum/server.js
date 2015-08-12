/*************************************************************************
 *
 * REV SOFTWARE CONFIDENTIAL
 *
 * [2013] - [2015] Rev Software, Inc.
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Rev Software, Inc. and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Rev Software, Inc.
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Rev Software, Inc.
 */


// For Collector Bridge
var collectorBridge = require("./collector_bridge");
// Settings 
var settings = require("./config/config");
//logging

var revlogger = require("rev-logger");

// var log = require("co-logger");
var qs = require("qs");
var uuid = require("node-uuid");

var roundToTwo = function(num) {
  return +(Math.round(num + "e+3") + "e-3");
}


//loading the geoip module
var geoip = require("geoip-lite");
// Url node module
var url = require("url");
// Cube node module
var cube = require("cube");
// Http node module
var http = require("http");
var https = require("https");
var fs = require("fs");
// Router node module
var router = require("router");
var route = router();
//getting the MD5 module
var md5 = require("MD5");
var rand = 0;
var max_val = 150000;

//for cluster
var cluster = require("cluster");

var numCPUs = require("os").cpus().length;

  /**
   *Md5 key generation
   */
var authkey = function() {
  revlogger.log('info', "MD5 authentication key generation");
  var salt = "aokimartxdzkvyiesztiizoigz";
  var inputtext = "revswtechv";
  var time = Math.floor(new Date().getTime() / 1000 / settings.service.nonce_validate_time);
  var token = time + inputtext + salt;
  return token;
}

function extractDomain(url) {
  var domain;
  //find & remove protocol (http, ftp, etc.) and get domain
  if (url.indexOf("://") > -1) {
    domain = url.split("/")[2];
  } else {
    domain = url.split("/")[0];
  }

  //find & remove port number
  domain = domain.split(":")[0];

  return domain;
}
var in_array = function(needle, haystack, argStrict) {
    var key = '',
      strict = !!argStrict;

    if (strict) {
      for (key in haystack) {
        if (haystack[key] === needle) {
          return true;
        }
      }
    } else {
      for (key in haystack) {
        if (haystack[key] == needle) {
          return true;
        }
      }
    }
    return false;
  }
  // open socket connection of single/multiple cubes
function openCubeConnection() {
  if (settings.is_multiple_collectors) {
    revlogger.log('info', "Open socket connection for multiple cubes");
    var no_of_cubes = settings.cube.length;
    for (i = 0; i < no_of_cubes; i++) {
      cube_url = settings.cube[i].protocol + "://" + settings.cube[i].domain + ":" + settings.cube[i].port;
      settings.cube[i].client = cube.emitter(cube_url);
    }
  } else {
    revlogger.log('info', "Open socket connection for Single cube");
    cube_url = settings.cube[0].protocol + "://" + settings.cube[0].domain + ":" + settings.cube[0].port;
    settings.cube[0].client = cube.emitter(cube_url);
  }
}
//Initiating the connection to be opened for all cube url's
openCubeConnection();

//Validating the Input request
function validate_pl_info_Request(params) {
  revlogger.log('debug', "Validating Navigation Timing params");
  var flag = true;
  if (params.hasOwnProperty("nt_dns_end") &&
    params.hasOwnProperty("nt_dns_st") && params.hasOwnProperty("nt_red_end") &&
    params.hasOwnProperty("nt_red_st") && params.hasOwnProperty("nt_con_end") &&
    params.hasOwnProperty("nt_con_st") && params.hasOwnProperty("nt_res_end") &&
    params.hasOwnProperty("nt_res_st") && params.hasOwnProperty("nt_load_end") &&
    params.hasOwnProperty("nt_load_st") && params.hasOwnProperty("nt_domcontloaded_end") &&
    params.hasOwnProperty("nt_domloading") && params.hasOwnProperty("nt_nav_st")) {
    revlogger.log('debug', "Navigation Timing : Valid Params");
    flag = true;
  } else {
    revlogger.log("alert", "Navigation Timing : Missing mandatory Params");
    return false;
  }
  Object.keys(params).forEach(function(key) {
    var value = params[key];
    if (key == "nt_dns_end" ||
      key == "nt_dns_st" || key == "nt_red_end" ||
      key == "nt_red_st" || key == "nt_con_end" ||
      key == "nt_con_st" || key == "nt_res_end" ||
      key == "nt_res_st" || key == "nt_load_end" ||
      key == "nt_load_st" || key == "nt_domcontloaded_end" ||
      key == "nt_domloading" || key == "nt_nav_st") {
      if (isNaN(parseInt(value))) {
        revlogger.log("alert", "Navigation Timing : Invalid '" + params[key] + "'Value");
        flag = false;
        return;
      }
    }

  });
  return flag;
}

function validate_nt_info_Request(params) {
  revlogger.log('debug', "Validating Roundtrip Params");
  var flag = true;
  if (params.hasOwnProperty("t_done")) {
    if (params.hasOwnProperty("t_resp")) {
      revlogger.log('debug', "Roundtrip : Valid Params");
      flag = true;
    } else {
      revlogger.log('debug', "Roundtrip : Missing Params");
      return false;
    }
  } else {
    revlogger.log('debug', "Roundtrip : Missing Params");
    return false;
  }
  Object.keys(params).forEach(function(key) {
    var value = params[key];
    if (key == "t_resp" || key == "t_done") {
      if (isNaN(parseInt(value))) {
        revlogger.log("alert", "Roundtrip : Invalid '" + params[key] + "' value");
        flag = false;
        return;
      }
    }

  });
  return flag;
}

//Validating the deviceType
var deviceType = function(value) {
  revlogger.log('debug', "Validating the Device type");
  var iPhonep = /iPhone;/i;
  var iPodp = /iPod;/i;
  var iPodp1 = /iPod/i;
  var iPadp = /iPad;/i;
  var androidp = /Android/i;
  var windowsp = /Windows Phone/i;
  var iosChrome = /CriOS/i;
  var fireFox = /Firefox/i;
  var chrome = /Chrome/i;
  var safari = /Safari/i;
  var ie = /Trident/i;

  if (iPhonep.test(value) || iPodp.test(value) || iPodp1.test(value) || iPadp.test(value)) {
    if (iosChrome.test(value)) {
      return "ios-chrome";
    } else {
      return "ios-safari";
    }
  } else if (androidp.test(value)) {
    if (fireFox.test(value)) {
      return "android-firefox";
    } else if (chrome.test(value)) {
      return "android-chrome";
    } else {
      return "android";
    }
  } else if (windowsp.test(value)) {
    return "windows-phone";
  } else if (chrome.test(value)) {
    return "chrome";
  } else if (fireFox.test(value)) {
    return "firefox";
  } else if (safari.test(value)) {
    return "safari";
  } else if (ie.test(value)) {
    return "ie";
  } else {
    return "others";
  }
}


//Sending data to cube
var cubeSend = function(object, client) {
  var loc = "";
  var reg = "";
  var cty = "";
  var latitude = "";
  var longitude = "";
  var llarr = [];
  //Validating the ipaddress and getting the geography value
  if (object.data.user_ip && object.data.user_ip != undefined) {
    revlogger.log('debug', "Fetching Location info from User IP");
    var geoJson = geoip.lookup(object.data.user_ip);
    if (geoJson && geoJson != "" && geoJson != undefined) {
      loc = geoJson.country;
      reg = geoJson.region;
      cty = geoJson.city;
      llarr = geoJson.ll;
    }

    if (llarr && llarr[0] != undefined) {
      latitude = llarr[0];
    }

    if (llarr && llarr[1] != undefined) {
      longitude = llarr[1];
    }
  }

  //Adding the domain to object
  if (object && object.data && object.data.u) {
    //log.info("Fetching Domain info from Beacon URL and adding it to Object");
    object.data.domain = object.data.u.split('//')[1].split('/')[0];
  }
  //Adding the geography to object
  if (loc && loc != undefined) {
    object.data.geography = loc;
  }
  //Adding the region to object				
  if (reg && reg != undefined) {
    object.data.region = reg;
  }
  //Adding the city to object				
  if (cty && cty != undefined) {
    object.data.city = cty;
  }

  //Adding the latitude to object				
  if (latitude && latitude != undefined) {
    object.data.latitude = latitude;
  }

  //Adding the longitude to object				
  if (longitude && longitude != undefined) {
    object.data.longitude = longitude;
  }

  // Don't send to Cube www.metacafe.com RUM reports
  if ( object.data.domain === 'www.metacafe.com' )
    revlogger.log('debug', 'Dropping www.metacafe.com request');
    return;
  }

  revlogger.log('debug', "obj----to cube-->" + object);
  revlogger.log("info", "Sending object to CUBE for domain " +  object.data.domain + ', user IP ' + object.data.user_ip);
  client.send(object);
}

process.on("uncaughtException", function(error) {
  revlogger.log("emerg", "ERROR HANDLING-->" + error.stack);
});

function validate_large_value_Request(params) {
  /**if pageloadTime < 0 OR browserTime < 0 OR networkTime < 0 OR backendTime < 0 then drop the event and do NOT send it to cube

  set MAX_VALUE = 150000;
  if pageloadTime > MAX_VALUE OR browserTime > MAX_VALUE OR networkTime > MAX_VALUE OR backendTime > MAX_VALUE then drop the event and do NOT send it to cube
  */

  var flag = true;
  if (params.pageloadTime < 0 || params.browserTime < 0 || params.networkTime < 0 || params.backendTime < 0) {
    flag = false;
  }

  if (params.pageloadTime > max_val || params.browserTime > max_val || params.networkTime > max_val || params.backendTime > max_val) {
    flag = false;
  }

  return flag;
}

/**
 * HTTP GET for BeaconURL data
 */
route.get("/service", function(request, response) {
  var transactionId = uuid.v4();
  revlogger.log("debug", "Received request with id - " + transactionId);
  //Getting the user-agent info -->Received request with id
  var device = deviceType(request.headers['user-agent']);
  var rt = 0;

  // ADED FOR USER IP
  var user_ip = "";
  if (settings.use_x_forwarded_for) {
    revlogger.log("debug", "Fetching User IP from request using X-Forwarded");
    var forwarded = require('forwarded-for');
    var address = forwarded(request, request.headers);
    //console.log("ADDRESS",address);
    if (address) {
      user_ip = address.ip;
    }
  } else {
    revlogger.log("debug", "Fetching User IP from request using ipware");
    var get_ip = require('ipware')().get_ip;
    var ip_info = get_ip(request);
    if (ip_info) {
      user_ip = ip_info.clientIp;
    }
  }
  revlogger.log('debug', "USER IP--> " + user_ip);

  revlogger.log('debug', "Parsing the request");
  var url_parts = url.parse(request.url, true);
  revlogger.log('debug', "Fetching query string");
  var query = url_parts.query;
  response.end();
  var res_domain = [];
  var resdom_duration = {};
  var totalDurTime = 0;
  var resourceTotal = 0;
  var rcnt = 0;
  var resourceNetworkTime = 0;
  var thridPartyResourceTime = 0;
  var thirdPartyCnt = 0;
  var ocnt = 0;
  var finalThirdParty = [];
  if (query && Object.keys(query).length > 0) {
    if (settings.process_res_timing && settings.process_res_timing != undefined) {
      revlogger.log('debug', "Processing third party resources");
      var qryResJson = qs.parse(query);
      if (qryResJson) {
        var mainDomain = extractDomain(qryResJson.u);
        var resourceTime = [];
        if (qryResJson.restiming && qryResJson.restiming != undefined) {
          rt = 1;
          for (var x in qryResJson.restiming) {
            if (qryResJson.restiming[x]) {
              resourceTime.push(qryResJson.restiming[x]);
            }
          }
          if (resourceTime.length > 0) {
            for (var i = 0; i < resourceTime.length; i++) {
              var extDomain = extractDomain(resourceTime[i].rt_name);
              if (mainDomain == extDomain) {
                resourceTotal = parseFloat(resourceTotal) + parseFloat(resourceTime[i].rt_dur);
                rcnt = parseInt(rcnt) + 1;
              } else {
                if (!in_array(extDomain, res_domain)) {
                  res_domain.push(extDomain);
                  resdom_duration[extDomain] = {}
                  resdom_duration[extDomain]['domain'] = extDomain;
                  resdom_duration[extDomain]['duration'] = []
                  resdom_duration[extDomain]['duration'].push(resourceTime[i].rt_dur);
                  resdom_duration[extDomain]['total'] = resourceTime[i].rt_dur;
                } else {
                  resdom_duration[extDomain]['total'] = parseFloat(resdom_duration[extDomain]['total']) + parseFloat(resourceTime[i].rt_dur);
                  resdom_duration[extDomain]['duration'].push(resourceTime[i].rt_dur);
                }

              }
            }
            if (rcnt > 0)
              resourceNetworkTime = parseFloat(resourceTotal) / parseInt(rcnt);

            for (var k in resdom_duration) {
              var resDomainResource = {}
              resDomainResource['d'] = resdom_duration[k].domain;
              resDomainResource['min'] = roundToTwo(Math.min.apply(null, resdom_duration[k].duration));
              resDomainResource['max'] = roundToTwo(Math.max.apply(null, resdom_duration[k].duration));
              var avgTime = resdom_duration[k].total / resdom_duration[k].duration.length;
              resDomainResource['avg'] = roundToTwo(avgTime)
              thridPartyResourceTime = parseFloat(avgTime) + parseFloat(thridPartyResourceTime);
              var cntotal = resdom_duration[k].duration.length;
              resDomainResource['count'] = cntotal;
              thirdPartyCnt = parseInt(thirdPartyCnt) + parseInt(cntotal);
              finalThirdParty.push(resDomainResource);
            }
          }
        }
        revlogger.log('debug', "Final third party resource JSON--> " + finalThirdParty);
      }
    }
    var nonce_value = true;
    if (settings.service.nonce) {
      if (query.hasOwnProperty("nonce")) {
//        log_debugMsg("Verifying the nonce param value with auth key");
        if (query.nonce === md5(authkey())) {
          nonce_value = true;
        } else {
          revlogger.log("alert", "Invalid nonce value");
          nonce_value = false;
        }
      } else {
        nonce_value = false;
      }
    }

    if (nonce_value) {
//      log_debugMsg("Verifying the nonce param value with auth key");
      if (settings.is_multiple_collectors) {
        //			console.log("Randome value:",Math.random());
        rand = Math.ceil((Math.random() * settings.cube.length) - 1);
        if (rand < 0) {
          rand = 1;
        } else if (rand > 7) {
          rand = 7;
        }
      }
      //		console.log("RANDOM : ", rand);
      var cube_url = settings.cube[rand].protocol + "://" + settings.cube[rand].domain + ":" + settings.cube[rand].port;
//      log_debugMsg("CUBE URL :", cube_url);
      var client = settings.cube[rand].client
  //    log_debugMsg("Client Object-->", client);

      /**
       * if nt = 0 we will need to extract the Navigation timing parameters
       */

      // Based on query string here we are generating a dynamic JSON object for cube to send	
      var pl_object = {};
      var nw_object = {};
      var send_object = null;
      var pl_pattern = /^nt_/
      var rt_pattern = /^rt./
      var bw_pattern = /^bw_/
//      log_debugMsg("Iterating the keys from query string and adding to JSON");
      // Iterating keys from query string, and adding each key w.r.t the JSON
      Object.keys(query).forEach(function(key) {
        var k1 = key.match(pl_pattern);
        var k2 = key.match(bw_pattern);
        var k3 = key.match(rt_pattern);
        var k4 = key.match(/^t_/);
        var resPattern = key.match(/^restiming/);
        /*	if(resPattern){
        		console.log("res keys-->",query[key]);	
        	}	*/
        if (k1) {
          //log.info("Extracting navigation timing params and adding to object");
          if (typeof(query[key]) == "string") {
            pl_object[key] = query[key];
          } else {
            pl_object[key] = parseInt(query[key])
          }
        }
        if (k3) {
          //log.info("Extracting roundtrip params to object");
          var replace_key = key.replace("rt.", "rt_");
          if (typeof(query[key]) == "string") {
            nw_object[replace_key] = query[key];
          } else {
            nw_object[replace_key] = parseInt(query[key])
          }
        }
        if (k2) {
          //log.info("Extracting Bandwidth params to object");
          if (typeof(query[key]) == "string") {
            pl_object[key] = query[key];
            nw_object[key] = query[key];
          } else {
            pl_object[key] = parseInt(query[key])
            nw_object[key] = parseInt(query[key])
          }
        }
        if (k4) {
          nw_object[key] = query[key]
        }
        if (key == "r") {
          if (typeof(query[key]) == "string") {
            nw_object[key] = query[key];
          } else {
            nw_object[key] = parseInt(query[key])
          }
        }

        if (key == "nt") {
          if (typeof(query[key]) == "string") {
            pl_object[key] = query[key];
            nw_object[key] = query[key];
          } else {
            pl_object[key] = parseInt(query[key])
            nw_object[key] = parseInt(query[key])
          }
        }
        if (key == "v" || key == "u" || key == "user_ip") {
          pl_object[key] = query[key]
          nw_object[key] = query[key]

        }
        if (key == "lat" || key == "lat_err") {
          nw_object[key] = query[key]
        }
      });
      send_object = {}
      send_object.time = new Date();
      send_object.type = "pl_info";
      /** For checking nt_nav_st & nt_load_end
      	if nt_nav_st = 0 then make nt_nav_st = nt_dns_st ;
      	if nt_load_end = 0 then make nt_load_end = nt_domcontentloaded_end ;
      */

      if (query.nt_nav_st && query.nt_nav_st != undefined && query.nt_nav_st == 0) {
        query.nt_nav_st = query.nt_dns_st;
      }

      if (query.nt_load_end && query.nt_load_end != undefined && query.nt_load_end == 0) {
        query.nt_load_end = query.nt_domcontloaded_end;
      }
      if (query.nt && query.nt == 1) {
//        log_debugMsg("Device supports Navigation timing.Extracting Navigation timing params");
        var dns = query.nt_dns_end - query.nt_dns_st;

        var redirect = query.nt_red_end - query.nt_red_st; // Redirect Time

        var tcp = query.nt_con_end - query.nt_con_st; // Connection Time

        var ssl = 0

        var basePageDownload = query.nt_res_end - query.nt_res_st; // Response Time

        var browser = query.nt_load_st - query.nt_res_end; // Navigation Time

        var dom = query.nt_domcontloaded_end - query.nt_domloading; // DOM Time

        var pageLoad = query.nt_load_st - query.nt_nav_st; //Total Time

        if (query.nt_load_end != 0) {
          pageLoad = query.nt_load_end - query.nt_nav_st;
        }

        var serverConnect = dns + redirect + tcp + ssl;

        var networkTime = serverConnect + basePageDownload; // Network Time

        var backendTime = query.nt_res_st - query.nt_req_st; //Backend Time

        pl_object.browserTime = browser;
        pl_object.networkTime = networkTime;
        pl_object.backendTime = backendTime;
        pl_object.pageloadTime = pageLoad;
        pl_object.fbTime = query.nt_res_st - query.nt_con_end;

        pl_object.nt_nav_st = query.nt_nav_st;
        pl_object.nt_load_end = query.nt_load_end;
        send_object.data = pl_object;
      }
      if (query.nt && query.nt == 0) {
//        log_debugMsg("No support for Nav timing.Extracting roundtrip and bandwidth params and adding to object");
        send_object.data = nw_object

        //Adding the device type to object
        send_object.data.device = device;

        if (user_ip != "" && user_ip != undefined) {
          send_object.data.user_ip = user_ip;
        } else {
          send_object.data.user_ip = query.user_ip;
        }

        send_object.data.nt_nav_st = query.nt_nav_st;
        send_object.data.nt_load_end = query.nt_load_end;
        //	send_object.data.third_party=resdom_duration;
        send_object.data.rt = rt;
        if (settings.process_res_timing && settings.process_res_timing != undefined) {
          if (send_object.data.rt && send_object.data.rt == 1) {
            send_object.data.resOrgNwTime = roundToTwo(resourceNetworkTime);
            send_object.data.resOrgCount = rcnt
            send_object.data.res3pDuration = roundToTwo(thridPartyResourceTime);
            send_object.data.res3pCount = thirdPartyCnt
            send_object.data.third_party = finalThirdParty;
          }
        }
        if (settings.request_uuid && settings.request_uuid != undefined) {
          send_object.data.transactionId = transactionId;
        }

        if (validate_nt_info_Request(send_object.data)) {
          if (parseInt(send_object.data.t_done) > parseInt(send_object.data.t_resp)) {
            send_object.data.backendTime = parseInt(send_object.data.t_resp);
            send_object.data.browserTime = parseInt(send_object.data.t_done) - parseInt(send_object.data.t_resp);
            send_object.data.pageloadTime = parseInt(send_object.data.t_done);
            send_object.data.fbTime = parseInt(send_object.data.t_resp);

            if (validate_large_value_Request(send_object.data)) {
              cubeSend(send_object, client);
            }
          }
        } else {
          send_object.data.backendTime = 0;
          send_object.data.pageloadTime = parseInt(send_object.data.rt_end) - parseInt(send_object.data.rt_bstart);
          send_object.data.fbTime = 0;
          send_object.data.browserTime = send_object.data.pageloadTime;

          if (validate_large_value_Request(send_object.data)) {
            //					log.info("Sending roundtrip & bandwidth object data to Cube");
            cubeSend(send_object, client);
          }
        }
      }

      if (query.nt && query.nt == 1) {
        if (validate_pl_info_Request(send_object.data)) {

          //Adding the device type to object
          send_object.data.device = device;
          //               	send_object.data.user_ip=user_ip;
          if (user_ip != "" && user_ip != undefined) {
            send_object.data.user_ip = user_ip;
          } else {
            send_object.data.user_ip = query.user_ip;
          }
          send_object.data.rt = rt;
          if (settings.process_res_timing && settings.process_res_timing != undefined) {
            if (send_object.data.rt && send_object.data.rt == 1) {
              send_object.data.resOrgNwTime = roundToTwo(resourceNetworkTime);
              send_object.data.resOrgCount = rcnt
              send_object.data.res3pDuration = roundToTwo(thridPartyResourceTime);
              send_object.data.res3pCount = thirdPartyCnt
              send_object.data.third_party = finalThirdParty;
            }
          }
          if (settings.request_uuid && settings.request_uuid != undefined) {
            send_object.data.transactionId = transactionId;
          }

          if (validate_large_value_Request(send_object.data)) {
            //					 log.info("Sending navigation timing object data to Cube");
            cubeSend(send_object, client);
          }
        }
      }
    }
  }

  //response.end();
});

var run_http_server = function() {
  //        console.log("Came in to the HTTP");
  http.createServer(route).listen(settings.service.http_port, settings.service.url);
  revlogger.log("info", "RUM service listening on http://" + settings.service.url + ":" + settings.service.http_port);
}

revlogger.log('info', 'Starting RUM service...');

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", function(worker, code, signal) {
    if (signal) {
      revlogger.log("warning", "worker was killed by signal: " + signal);
    } else if (code !== 0) {
      revlogger.log("warning", "worker exited with error code: " + code);
    }
    cluster.fork();
  });
  process.on("uncaughtException", function(error) {
    revlogger.log("emerg", "ERROR HANDLING--> " + error.stack);
  });

} else {
  //Creating server which listen port to the given domain or ip
  if (settings.is_https != undefined && settings.is_https) {
    //		console.log("Came in to the HTTPS");
    var options = {};
    if (settings.key_path != undefined && settings.key_path != '' && settings.cert_path != undefined && settings.cert_path != '' && settings.ca_path != '' && settings.ca_path != undefined) {
      options.key = fs.readFileSync(settings.key_path);
      options.cert = fs.readFileSync(settings.cert_path);
      options.ca = fs.readFileSync(settings.ca_path)
      https.createServer(options, route).listen(settings.service.https_port, settings.service.url);
      run_http_server();
      revlogger.log('info', "RUM service listening https://"+settings.service.url+":"+settings.service.https_port);
    } else {
      run_http_server();
    }
  } else {
    run_http_server();
  }
}
