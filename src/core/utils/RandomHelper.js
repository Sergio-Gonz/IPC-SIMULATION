class RandomHelper {
  static getRandomTime(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  static getRandomFromArray(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }

  static getRandomProcessType(permissions) {
    if (!permissions?.processTypes) return null;
    return this.getRandomFromArray(permissions.processTypes);
  }

  static getRandomAction(permissions) {
    if (!permissions?.actions) return null;
    return this.getRandomFromArray(permissions.actions);
  }

  static generateProcessId(socketId) {
    return `${socketId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static getRandomPriority(min = 1, max = 3) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static getRandomParameters() {
    return {
      value: Math.random() * 100,
      iterations: Math.floor(Math.random() * 10) + 1,
    };
  }
}

module.exports = RandomHelper;
