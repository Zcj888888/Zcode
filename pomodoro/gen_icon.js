const fs = require('fs');
  const zlib = require('zlib');
  function makePng(size) {
    const raw = Buffer.alloc((size*4+1)*size, 0);
    const cx = size/2, cy = size/2, r = size*0.4;
    for (let y = 0; y < size; y++) {
      const ro = y*(size*4+1); raw[ro] = 0;
      for (let x = 0; x < size; x++) {
        const p = ro+1+x*4;
        const dx = x-cx, dy = y-cy;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (dist <= r) {
          const alpha = dist > r-1 ? Math.round(255*(r-dist)) : 255;
          raw[p]=255; raw[p+1]=59; raw[p+2]=48; raw[p+3]=alpha;
        }
      }
    }
    const d = zlib.deflateSync(raw);
    function crc(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++){c^=b[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xEDB88320:0);}return(c^0xFFFFFFFF)>>>0;}
    function ch(t,da){const l=Buffer.alloc(4);l.writeUInt32BE(da.length);const tb=Buffer.from(t);const
  cr=Buffer.alloc(4);cr.writeUInt32BE(crc(Buffer.concat([tb,da])));return Buffer.concat([l,tb,da,cr]);}
    const sig=Buffer.from([137,80,78,71,13,10,26,10]);
    const ih=Buffer.alloc(13);ih.writeUInt32BE(size,0);ih.writeUInt32BE(size,4);ih[8]=8;ih[9]=6;
    return Buffer.concat([sig,ch('IHDR',ih),ch('IDAT',d),ch('IEND',Buffer.alloc(0))]);
  }
  const png32 = makePng(32);
  fs.writeFileSync('src/assets/icon.png', png32);
  console.log('icon.png: ' + png32.length + ' bytes');