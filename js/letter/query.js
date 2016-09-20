'use strict';
// wraps basic get and post requests with success and failure callbacks
// copyright 2016 Samuel Baird MIT Licence

define([], function () {
	// internal functions
	var query = function (method, url, data, successHandler, errorHandler, timeout) {
		var xhr = typeof XMLHttpRequest != 'undefined' ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');

		xhr.open(method, url, true);
		xhr.onreadystatechange = function() {
			var status;
			var data;
			if (xhr.readyState == 4) { // `DONE`
				status = xhr.status;
				if (status == 200) {
					if (xhr.responseText != '') {
						data = JSON.parse(xhr.responseText);
					}
					successHandler && successHandler(data);
				} else {
					errorHandler && errorHandler(status);
				}
			}
		};
		if (timeout != undefined) {
			xhr.timeout = timeout;
		}

		if (data != null) {
			xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		  	xhr.send(JSON.stringify(data));
		} else {
			xhr.send();
		}
		
		return xhr;
	}	
	
	// public API
	return {
		post : function (url, data, successHandler, errorHandler) {
			return query('post', url, data, successHandler, errorHandler);
		},
		get : function (url, successHandler, errorHandler) {
			return query('get', url, null, successHandler, errorHandler);
		}
	}
});
