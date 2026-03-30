// Map data loader - parses testMap.map binary format
// The map is stored as a binary file with: version(int), width(int), height(int),
// then for each of 5 maps: width*height strings (tile type names)

const MapDataLoader = {
    // We'll parse the binary map file
    async loadMapData(url) {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return this.parseMapFile(buffer);
    },

    parseMapFile(buffer) {
        const view = new DataView(buffer);
        let offset = 0;

        function readInt() {
            const val = view.getInt32(offset, true);
            offset += 4;
            return val;
        }

        function readString() {
            // Strings are null-terminated in the Daisy engine format
            const bytes = new Uint8Array(buffer);
            let str = '';
            while (offset < bytes.length) {
                const byte = bytes[offset];
                offset++;
                if (byte === 0) break;
                str += String.fromCharCode(byte);
            }
            return str;
        }

        const version = readInt();
        const mapWidth = readInt();
        const mapHeight = readInt();
        const numMaps = 5;
        const maps = [];

        for (let m = 0; m < numMaps; m++) {
            const field = [];
            for (let x = 0; x < mapWidth; x++) {
                field[x] = [];
                for (let y = 0; y < mapHeight; y++) {
                    field[x][y] = null;
                }
            }
            for (let y = 0; y < mapHeight; y++) {
                for (let x = 0; x < mapWidth; x++) {
                    const value = readString();
                    if (value !== '') {
                        field[x][y] = value;
                    }
                }
            }
            maps.push({ field, width: mapWidth, height: mapHeight });
        }

        return { maps, mapWidth, mapHeight };
    }
};
