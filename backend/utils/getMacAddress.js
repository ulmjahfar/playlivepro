const os = require('os');

/**
 * Get the MAC address of the primary network interface
 * @returns {String} MAC address or null if not found
 */
function getMacAddress() {
  try {
    const networkInterfaces = os.networkInterfaces();
    
    // Priority order: Ethernet, Wi-Fi, then any other interface
    const priorityOrder = ['Ethernet', 'Wi-Fi', 'eth0', 'wlan0', 'en0', 'en1'];
    
    // Try to find MAC address in priority order
    for (const priorityName of priorityOrder) {
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (name.includes(priorityName) || priorityName.includes(name)) {
          for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
              return iface.mac;
            }
          }
        }
      }
    }
    
    // Fallback: get first non-internal interface with a valid MAC
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting MAC address:', error);
    return null;
  }
}

/**
 * Get all MAC addresses from all network interfaces
 * @returns {Array<String>} Array of MAC addresses
 */
function getAllMacAddresses() {
  try {
    const networkInterfaces = os.networkInterfaces();
    const macAddresses = [];
    
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (iface.mac && iface.mac !== '00:00:00:00:00:00' && !macAddresses.includes(iface.mac)) {
          macAddresses.push(iface.mac);
        }
      }
    }
    
    return macAddresses;
  } catch (error) {
    console.error('Error getting all MAC addresses:', error);
    return [];
  }
}

module.exports = { getMacAddress, getAllMacAddresses };

