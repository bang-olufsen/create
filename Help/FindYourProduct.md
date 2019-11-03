# Find Your Product

If you're using Beocreate Connect, it should automatically discover Beocreate 2 sound systems on your network. Sometimes things don't work as expected and the product isn't found.

## Check Network Connection

Make sure that your computer is on the same network as the sound system.

If the sound system can't connect to a network itself, it will automatically start its setup hotspot which you should connect to for checking network settings. The hotspot name is similar to **Beocreate\_Setup\_abc12d3**.

## Type Product Address Manually

You can type the address of the product manually into a web browser to access the user interface.

- If the product hasn't been set up yet, it will be called **Beocreate**. In this case, you can type *Beocreate.local* to the address bar.
- If you have set up the product and changed the product name, the address has also changed. For some product names, the address may not be exactly the same – spaces and underscores have been replaced with hyphens (-) and non-ASCII characters (such as ÜÅÄÖ) have been removed. In any case, the address always ends with *.local*.
- If your operating system or browser doesn't support *local hostnames* like above, type in the IP address of the product. The easiest way to find out the IP address is to connect the Raspberry Pi to a display. If you see a "HiFiBerryOS" logo on the screen, the IP address should be listed below it. On some systems you can also access the setup interface this way by connecting a keyboard and mouse.