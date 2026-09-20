export const BLE_DISCOVERY_PARSING_RUNTIME = `function normalizeAddress(address) {
  if (address === undefined || address === null) {
    return "";
  }
  var text = String(address).toUpperCase();
  var normalized = "";
  for (var index = 0; index < text.length; index += 1) {
    var character = text.charAt(index);
    if (character !== ":" && character !== "-") {
      normalized += character;
    }
  }
  return normalized;
}

function formatRuntimeAddress(address) {
  var normalized = normalizeAddress(address);
  if (normalized.length !== 12) {
    return String(address || "");
  }
  return normalized.slice(0, 2) + ":" + normalized.slice(2, 4) + ":" + normalized.slice(4, 6) + ":" + normalized.slice(6, 8) + ":" + normalized.slice(8, 10) + ":" + normalized.slice(10, 12);
}

function dataLength(data) {
  if (!data) {
    return 0;
  }
  if (typeof data === "string") {
    return data.length;
  }
  if (data.length !== undefined) {
    return data.length;
  }
  return 0;
}

function readByte(data, offset) {
  if (offset < 0 || offset >= dataLength(data)) {
    return null;
  }
  var value = typeof data === "string" ? data.charCodeAt(offset) : data[offset];
  if (typeof value === "string") {
    value = value.charCodeAt(0);
  }
  if (value === undefined || value === null) {
    return null;
  }
  return value & 255;
}

function ds(data, start, end) {
  if (typeof data === "string") {
    return data.slice(start, end);
  }
  if (data.slice) {
    return data.slice(start, end);
  }
  return null;
}

function i2(data, offset) {
  var low = readByte(data, offset);
  var high = readByte(data, offset + 1);
  if (low === null || high === null) {
    return null;
  }
  var value = low | (high << 8);
  return value & 32768 ? value - 65536 : value;
}

function advDataHasNamePrefix(data, prefix) {
  var length = dataLength(data);
  var offset = 0;
  while (offset < length) {
    var fieldLength = readByte(data, offset);
    if (fieldLength === null || fieldLength === 0) {
      return false;
    }
    var fieldStart = offset + 1;
    var fieldEnd = fieldStart + fieldLength;
    if (fieldEnd > length) {
      return false;
    }
    var type = readByte(data, fieldStart);
    var dataLengthInField = fieldLength - 1;
    if ((type === 8 || type === 9) && dataLengthInField >= prefix.length) {
      var matches = true;
      for (var index = 0; index < prefix.length; index += 1) {
        if (readByte(data, fieldStart + 1 + index) !== prefix.charCodeAt(index)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return true;
      }
    }
    offset = fieldEnd;
  }
  return false;
}

function bd(data) {
  var length = dataLength(data);
  var offset = 0;
  while (offset < length) {
    var fieldLength = readByte(data, offset);
    if (fieldLength === null || fieldLength === 0) {
      return false;
    }
    var fieldStart = offset + 1;
    var fieldEnd = fieldStart + fieldLength;
    if (fieldEnd > length) {
      return false;
    }
    var type = readByte(data, fieldStart);
    if (type === 22 && fieldLength >= 3) {
      if (readByte(data, fieldStart + 1) === 210 && readByte(data, fieldStart + 2) === 252) {
        return ds(data, fieldStart + 3, fieldEnd);
      }
    }
    offset = fieldEnd;
  }
  return null;
}

function findManufacturerDataRange(data) {
  var length = dataLength(data);
  var offset = 0;
  while (offset < length) {
    var fieldLength = readByte(data, offset);
    if (fieldLength === null || fieldLength === 0) {
      return null;
    }
    var fieldStart = offset + 1;
    var fieldEnd = fieldStart + fieldLength;
    if (fieldEnd > length) {
      return null;
    }
    var type = readByte(data, fieldStart);
    if (type === 255 && fieldLength >= 2) {
      return { offset: fieldStart + 1, length: fieldLength - 1 };
    }
    offset = fieldEnd;
  }
  return null;
}

function parseTp357Payload(data, offset, length) {
  if (length < 6) {
    return { ok: false, reason: "tp357-payload-too-short" };
  }
  var temperatureLow = readByte(data, offset + 1);
  var temperatureHigh = readByte(data, offset + 2);
  var humidity = readByte(data, offset + 3);
  var battery = readByte(data, offset + 4);
  if (temperatureLow === null || temperatureHigh === null || humidity === null || battery === null) {
    return { ok: false, reason: "tp357-payload-truncated" };
  }
  var temperatureRaw = temperatureLow | (temperatureHigh << 8);
  if (temperatureRaw & 32768) {
    temperatureRaw = temperatureRaw - 65536;
  }
  var temperature = temperatureRaw / 10;
  if (humidity > 100 || temperature < -50 || temperature > 100) {
    return { ok: false, reason: "tp357-range-invalid" };
  }
  return { ok: true, temperature: temperature, humidity: humidity, battery: battery };
}

function btd(result) {
  if (!result) {
    return null;
  }
  if (result.service_data) {
    if (result.service_data.fcd2 !== undefined) {
      return result.service_data.fcd2;
    }
    if (result.service_data.FCD2 !== undefined) {
      return result.service_data.FCD2;
    }
  }
  if (result.advData) {
    return bd(result.advData);
  }
  return null;
}

function pbt(data) {
  var length = dataLength(data);
  if (length < 2) {
    return {};
  }
  var info = readByte(data, 0);
  if (info === null || (info & 1) === 1 || info >> 5 !== 2) {
    return {};
  }
  var candidate = {};
  var offset = 1;
  while (offset < length) {
    var objectId = readByte(data, offset);
    offset += 1;
    if (objectId === 0) {
      offset += 1;
    } else if (objectId === 1) {
      candidate.b = readByte(data, offset);
      offset += 1;
    } else if (objectId === 12) {
      offset += 2;
    } else if (objectId === 2) {
      var temperature = i2(data, offset);
      if (temperature === null) {
        return candidate;
      }
      candidate.t = temperature / 100;
      offset += 2;
    } else if (objectId === 3) {
      var humidity = readByte(data, offset);
      var humidityHigh = readByte(data, offset + 1);
      if (humidity === null || humidityHigh === null) {
        return candidate;
      }
      candidate.h = (humidity | (humidityHigh << 8)) / 100;
      offset += 2;
    } else if (objectId === 46) {
      var shortHumidity = readByte(data, offset);
      if (shortHumidity === null) {
        return candidate;
      }
      candidate.h = shortHumidity;
      offset += 1;
    } else if (objectId === 69) {
      var shortTemperature = i2(data, offset);
      if (shortTemperature === null) {
        return candidate;
      }
      candidate.t = shortTemperature / 10;
      offset += 2;
    } else {
      return candidate;
    }
  }
  return candidate;
}

`;
