#!/usr/bin/env node

/**
 * Helper script to get your computer's local IP address for iPad access
 * Run: node get-ip.js
 */

const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: name,
          address: iface.address
        });
      }
    }
  }

  return addresses;
}

console.log('\n🌐 Local IP Address(es) for iPad Access:\n');
console.log('═'.repeat(50));

const addresses = getLocalIP();

if (addresses.length === 0) {
  console.log('❌ No network interfaces found!');
  console.log('Make sure you are connected to WiFi or ethernet.');
} else {
  addresses.forEach((addr, index) => {
    console.log(`\n${index + 1}. ${addr.interface}`);
    console.log(`   IP: ${addr.address}`);
    console.log(`   Backend URL: http://${addr.address}:3001`);
    console.log(`   Frontend URL: http://${addr.address}:3000`);
  });

  console.log('\n' + '═'.repeat(50));
  console.log('\n📱 On your iPad:');
  console.log('   1. Make sure iPad is on the SAME WiFi network');
  console.log(`   2. Open Safari and go to: http://${addresses[0].address}:3000`);
  console.log('   3. Connect your Phantom wallet');
  console.log('\n💡 Tip: If multiple IPs shown, use the one that looks like:');
  console.log('   192.168.x.x or 10.x.x.x\n');
}
