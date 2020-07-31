// wraps basic get and post requests with success and failure callbacks
// copyright 2020 Samuel Baird MIT Licence

// internal functions
function query (method, url, data, successHandler, errorHandler, timeout) {
	const xhr = new XMLHttpRequest();

	xhr.open(method, url, true);
	xhr.onreadystatechange = function () {
		let status;
		let data;
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
		xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
		xhr.send(JSON.stringify(data));
	} else {
		xhr.send();
	}

	return xhr;
}

// public api

function post (url, data, successHandler, errorHandler) {
	return query('post', url, data, successHandler, errorHandler);
}

function get (url, successHandler, errorHandler) {
	return query('get', url, null, successHandler, errorHandler);
}

export { post, get };
