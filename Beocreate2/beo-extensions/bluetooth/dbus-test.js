process.env.NODE_PATH = "/usr/lib/node_modules/";
require('module').Module._initPaths();

const dbus = require('dbus-native');

/*
	This test file's purpose is to show how to query a simple, basic DBus service with this library.
	In order to do that, we connect to the session bus, request the basic service (launch with 'node basic-service.js')
	and issue method calls.

	For instance you can use `gdbus` to introspect a service and make function calls.
	- introspect: `gdbus introspect -e -d com.dbus.native.return.types -o /com/dbus/native/return/types`
	- make a method call: `gdbus introspect -e -d com.dbus.native.return.types -o /com/dbus/native/return/types -m com.dbus.native.return.types.FunctionName`
*/

console.log("Bluetooth DBus test");

const serviceName = 'org.bluez.hci0.dev_08_F6_9C_4E_86_B7.fd0'; // the service we request

// The interface we request of the service
const interfaceName = "org.bluez";

// The object we request
const objectPath = `/${serviceName.replace(/\./g, '/')}`;

// First, connect to the session bus (works the same on the system bus, it's just less permissive)
const systemBus = dbus.systemBus();

// Check the connection was successful
if (!systemBus) {
  throw new Error('Could not connect to the DBus system bus.');
}

const service = systemBus.getService(serviceName);

service.getInterface(objectPath, interfaceName, (err, iface) => {
  if (err) {
    console.error(
      `Failed to request interface '${interfaceName}' at '${objectPath}' : ${
        err
      }`
        ? err
        : '(no error)'
    );
    process.exit(1);
  }


  iface.on('PropertiesChanged', nb => {
    console.log(`Received Rand: ${nb}`);
  });
});
