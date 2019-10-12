
// Dictionary holding data from different tabs.
// key = "<video_url>" 
var tracker_intervals = {}

// SUPREME TURBO JANK MODE ENGAGE
// ALL OF THESE use the url of the video as a key
// The last interval that we're updating live
var last_start = {},
    last_end =   {};
// AH AH AH JOTARU-SAN, YOU THINK YOU'VE SEEN THE
// EXTENT OF MY JANKINESS??? BAAAAKARUU
var video_length = {};

// TODO: Username. Figure this shit out
var _username = "emptyuser";
function get_username() {
  return _username;
}


// Record a watch interval.
//    start: Time where the user started watching
//    end  : Time where the user ended watching
function tracker_record_interval(username, video_url, start, end, length) {
  // TODO: Consistency
  var key = video_url;
  if (!(key in tracker_intervals)) {
    //alert("New key: " + key);
    tracker_intervals[key] = [];
    //alert(Object.keys(tracker_intervals));
  }
  video_length[key] = length;
  // If our start value is close enough to the last
  // end value, merge the two intervals together and
  // ignore the small blip of watch that the user probably
  // skipped anyway.
  var len = tracker_intervals[key].length; 
  if (len != 0) {
    var prev = tracker_intervals[key][ len - 1 ];
    var delta = Math.abs(start - prev["end"]);
    // TODO: Arbitrary constant
    if (delta < 0.9) {
      // Too close, merge and quit.
      tracker_intervals[key][ len - 1 ]["end"] = end;
      return;
    }
  }

  // Otherwise, just add the interval.
  tracker_intervals[key].push( {"start": start, "end": end} );
}

// Receive data from our extension and append to our interval storage
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(sender.tab ?
      "from a content script:" + sender.tab.url :
      "from the extension"
    );
    switch (request.type) {
      case "interval":
        // TODO: Username
        _username = request.user;
        tracker_record_interval(_username, request.url, request.start, request.end, request.length);
        sendResponse("gucci");
        break;
      case "interval_end":
        var key = request.url;
        last_start[key] = request.start;
        last_end[key] = request.time;
        // TODO: Username
        _username = request.user;
        // If the tracker interval list for this url doesn't exist, make it.

        if (!(key in tracker_intervals)) {
          //alert("interval New key: " + key + ", " + request.start + ":" + request.time);
          tracker_intervals[key] = [];
        }
        video_length[key] = request.length;

        sendResponse("gucci");
        break;

    }
    sendResponse("oops");
  }
);


// Update all tabs that aren't here anymore
function tracker_send_all(username) {
  //alert("Send All Called");
  chrome.tabs.getAllInWindow(null, function(tabs) {
    // Store all of the current open tabs in a set
    var tabset = new Set([]);
    for (var i = 0; i < tabs.length; i++) {
      var open_tab = tabs[i];
      tabset.add(open_tab.url);
      console.log("DEBUG: set: " + open_tab.url);
      //chrome.tabs.sendRequest(tabs[i].id, { action: "xxx" });                         
    }

    // Now we know what tabs are open. We will scroll through all our data and
    // update
    var keys = Object.keys(tracker_intervals);
    for (var i = 0; i < keys.length; ++i) {
      var key = keys[i];
      // TODO: Consistency
      // TODO: kinda jank but, it works. Right?
      var url = key;
      //alert("DEBUG: TRYING: " + key);
      console.log("DEBUG: TRYING: " + url);
      if (!tabset.has(url)) {
        //alert("DEBUG: Did not find " + url + " in set!");
        console.log("DEBUG: Did not find " + url + " in set!");
        tracker_send_data(username, url, video_length[url]);
      }
    }
  });
}


// We've recorded our user's tracking data, now send it.
function tracker_send_data(username, video_url, length) {
  // TODO: Consistency
  var key = video_url;

  // Add the last interval if it exists
  var last_begin    = last_start[key],
      last_finish   = last_end[key];
  if (last_begin != undefined && last_finish != undefined) {
    //alert("Aw yeah: " + last_begin + " -> " + last_finish);
    tracker_record_interval(username, video_url, last_begin, last_finish);
  }

  var intervals = tracker_intervals[key];

  // TODO: Debugging prints
  console.log("SENDING INTERVALS");
  console.log(intervals);
  // Merge the tracked intervals
  intervals = merge_intervals(intervals);

  var url = "loalhost" + "/TODO: Figure me out";
  var data = {
    "user": username,
    "video_url": video_url,
    "video_length": length,
    "intervals": intervals,
  };
  $.ajax({
    type: "POST",
    url: url,
    data: data,
    success: function() {
      // Delete our data and say we gucci
      alert("DEBUG: Data Sent!");
      console.log("Data Sent");
      tracker_intervals.delete(key);
    },
    error: function() {
      alert("DEBUG: Data failed to send! But we got here.");
      // If you're here to remove this, I don't blame you.
      console.error("I don't EAT them because they're shaped like DINOSAURS, I EAT them because they're FUCKING CHICKEN NUGGETS");
      console.error("Failed to send data to " + url + " with key:  " + key);
    }
  });
}

// When a tab closes, update and send to server if necessary
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  var username = get_username();
  tracker_send_all(username); 
});

// When a tab changes and we switch URLs, update and send to server if necessary
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {

  // If our URL Changed
  if (changeInfo.url) {
    // TODO: Delete if we're not using. This checks whether that tab has a content script, but we don't care.
    //chrome.tabs.sendMessage(tabId, {text: "are_you_there_content_script?"}, function(msg) {
    //  msg = msg || {};
    //  if (msg.status == 'yes') {
        var username = get_username();
        tracker_send_all(username);
    //  }
    //});
  }
});



// Thank you leetcode
function merge_intervals(intervals) {

  if (intervals.length == 0) {
    return [];
  }

  // Sort by start time
  intervals.sort(function(left, right) {
    return left["start"] - right["start"]
  });

  result = [];

  var start = intervals[0]["start"];
  var end = intervals[0]["end"];
  for(var i = 1; i < intervals.length; ++i) {
    var interval = intervals[i];
    // If we're beyond the range
    if (interval["start"] > end) {
      result.push([start, end]);
      start = interval["start"];
      end = interval["end"];
    } else {
      // If our end is below, we're ignored.
      if (interval["end"] <= end) {
        // Ignore
        continue;
      } else if (interval["start"] <= end) {
        end = interval["end"];
      }
    }
  }
  // At the end: Push left over
  result.push([start, end]);

  return result;
}