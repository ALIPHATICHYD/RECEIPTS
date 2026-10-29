// Draws the landing-page footer: a dithered stadium where a Receipts printer in
// the players' tunnel prints a receipt that rolls across the pitch.
// Regenerate with: node scripts/footer-stadium.mjs > src/assets/footer-stadium.svg
let s=23;const r=()=>(s=(s*16807)%2147483647)/2147483647;
const W=1440,H=600,I='#121212',P='#F2EFE6',R='#FFFDF7',O='#E8461E',C='#1F4FD8',cx=720;
const f=n=>n.toFixed(1);const o=[];const u=x=>(x-cx)/cx;
const rimY=x=>215-95*u(x)**2, pitchTop=x=>338-24*u(x)**2;
const defs=[1,1.25,1.55,1.9,2.3].map((rr,i)=>`<pattern id="fs-d${i}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="${rr*0.62}" fill="${P}"/></pattern>`).join('')
 +`<pattern id="fs-h0" width="6" height="6" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="1.4" height="1.4" fill="${P}"/></pattern>`
 ;
// floodlight beams (dithered cones) converging on centre
const lights=[[110,40],[430,96],[1010,96],[1330,40]];
for(const [lx,ly] of lights){o.push(`<path d="M${lx-14} ${ly+12} L${cx-110} ${H-220} L${cx+110} ${H-220} L${lx+14} ${ly+12}Z" fill="url(#fs-d0)" opacity="0.45"/>`)}
// roof
let d=`M0 ${f(rimY(0)-30)}`;for(let x=0;x<=W;x+=10)d+=` L${x} ${f(rimY(x)-30+6*u(x)**2)}`;for(let x=W;x>=0;x-=10)d+=` L${x} ${f(rimY(x)-4)}`;o.push(`<path d="${d}Z" fill="url(#fs-d3)"/>`);
let rl='';for(let x=0;x<=W;x+=10)rl+=(rl?' L':'M')+x+' '+f(rimY(x)-30+6*u(x)**2);o.push(`<path d="${rl}" stroke="${P}" stroke-width="2.5" fill="none"/>`);
for(let x=0;x<=W;x+=48)o.push(`<path d="M${x} ${f(rimY(x)-28)} L${x+24} ${f(rimY(x+24)-8)} L${x+48} ${f(rimY(x+48)-28)}" stroke="${I}" stroke-width="1.6" fill="none"/>`);
// stands base dither + crowd
d=`M0 ${f(rimY(0))}`;for(let x=0;x<=W;x+=10)d+=` L${x} ${f(rimY(x))}`;for(let x=W;x>=0;x-=10)d+=` L${x} ${f(pitchTop(x)-10)}`;o.push(`<path d="${d}Z" fill="url(#fs-h0)" opacity="0.6"/>`);
const rows=24;for(let i=0;i<rows;i++){const t=(i+0.5)/rows;for(let x=2;x<W;x+=3+r()*3.5){if(r()<0.55){const y=rimY(x)+(pitchTop(x)-12-rimY(x))*t;
  // brighter crowd near centre (lit by beams)
  const lit=1-Math.min(1,Math.abs(u(x))*1.4);o.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(1.3+t*1.1)}" height="${f(1.3+t*1.1)}" fill="${P}" opacity="${(0.35+0.6*lit*r()+0.2).toFixed(2)}"/>`)}}}
for(const t of [0.45]){let p='';for(let x=0;x<=W;x+=8)p+=(p?' L':'M')+x+' '+f(rimY(x)+(pitchTop(x)-12-rimY(x))*t);o.push(`<path d="${p}" stroke="${P}" stroke-width="1.6" fill="none"/>`)}
for(let a=-7;a<=7;a++){const xb=cx+a*104,xt=cx+a*120;o.push(`<line x1="${f(xt)}" y1="${f(rimY(xt))}" x2="${f(xb)}" y2="${f(pitchTop(xb)-12)}" stroke="${I}" stroke-width="4"/>`)}
// ad boards in stamp orange
d=`M0 ${f(pitchTop(0)-11)}`;for(let x=0;x<=W;x+=10)d+=` L${x} ${f(pitchTop(x)-11)}`;for(let x=W;x>=0;x-=10)d+=` L${x} ${f(pitchTop(x)+1)}`;o.push(`<path d="${d}Z" fill="${O}"/>`);
{let cl='';for(let x=0;x<=W;x+=10)cl+=(cl?' L':'M')+x+' '+f(pitchTop(x)-2);o.push(`<path id="fs-adline" d="${cl}" fill="none"/><text font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="${I}" letter-spacing="1"><textPath href="#fs-adline">${'RECEIPTS · WALRUS MEMORY · TATUM · SUI · x402 · '.repeat(8)}</textPath></text>`)}
// floodlight towers
for(const [lx,ly] of lights){const base=rimY(lx)-30;o.push(`<line x1="${lx}" y1="${f(base)}" x2="${lx}" y2="${ly+20}" stroke="${P}" stroke-width="3"/>`);
  o.push(`<rect x="${lx-24}" y="${ly}" width="48" height="20" fill="${P}"/>`);for(let i=0;i<4;i++)for(let j=0;j<2;j++)o.push(`<rect x="${lx-20+i*11}" y="${ly+3+j*9}" width="7" height="5" fill="${I}"/>`)}
// pitch: banded dither, denser toward viewer
const y0=pitchTop(cx)+2;const bands=12;
for(let k=0;k<bands;k++){const a=y0+(H-y0)*Math.pow(k/bands,1.4),b=y0+(H-y0)*Math.pow((k+1)/bands,1.4);
  const pat=k%2? 'd'+Math.min(4,1+Math.floor(k/3)) : 'd'+Math.min(3,Math.floor(k/3));
  let pd=`M0 ${f(a+(k==0?24:0))}`;if(k==0){pd='M0 '+f(pitchTop(0)+2);for(let x=0;x<=W;x+=10)pd+=` L${x} ${f(pitchTop(x)+2)}`}else pd+=` L${W} ${f(a)}`;
  pd+=` L${W} ${f(b)} L0 ${f(b)}Z`;o.push(`<path d="${pd}" fill="url(#fs-${pat})"/>`)}
// printer in the tunnel; receipt strip rolls toward viewer as halfway line
const ln=(dd,w)=>o.push(`<path d="${dd}" stroke="${P}" stroke-width="${w}" fill="none"/>`);
// far touchline only + side goal areas (camera looks along halfway line)
ln(`M0 ${y0+10} Q ${cx} ${y0+2} ${W} ${y0+10}`,2.5);
ln(`M0 ${y0+40} L120 ${y0+40} L60 ${H-60} L0 ${H-60}`,2);ln(`M${W} ${y0+40} L${W-120} ${y0+40} L${W-60} ${H-60} L${W} ${H-60}`,2);
const ccy=480;ln(`M${cx-300} ${ccy} a300 70 0 1 0 600 0 a300 70 0 1 0 -600 0`,3);
// tunnel arch cut into the stand + ad board
const tw2=220,tt=232;o.push(`<path d="M${cx-tw2/2} ${f(pitchTop(cx)+1)} V${tt+40} Q${cx} ${tt-18} ${cx+tw2/2} ${tt+40} V${f(pitchTop(cx)+1)}Z" fill="${I}"/>`);
o.push(`<path d="M${cx-tw2/2} ${tt+40} Q${cx} ${tt-18} ${cx+tw2/2} ${tt+40}" stroke="${P}" stroke-width="2" fill="none"/>`);
// printer body
const pw=170,ph=78,px0=cx-pw/2,py0=pitchTop(cx)-ph+6;
o.push(`<rect x="${px0+8}" y="${py0+6}" width="${pw}" height="${ph}" fill="url(#fs-d1)"/>`);
o.push(`<path d="M${px0} ${py0+14} Q${px0} ${py0} ${px0+14} ${py0} H${px0+pw-14} Q${px0+pw} ${py0} ${px0+pw} ${py0+14} V${py0+ph} H${px0}Z" fill="${R}"/>`);
o.push(`<rect x="${px0}" y="${py0+ph-26}" width="${pw}" height="26" fill="url(#fs-d4)" opacity="0.0"/>`);
o.push(`<rect x="${px0+22}" y="${py0+ph-20}" width="${pw-44}" height="6" fill="${I}"/>`);
o.push(`<text x="${px0+18}" y="${py0+26}" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="17" font-stretch="75%" fill="${I}">RECEIPTS</text>`);
o.push(`<circle cx="${px0+pw-22}" cy="${py0+20}" r="5" fill="${O}"/><circle cx="${px0+pw-40}" cy="${py0+20}" r="5" fill="none" stroke="${I}" stroke-width="1.5"/>`);
o.push(`<text x="${px0+18}" y="${py0+44}" font-family="JetBrains Mono, monospace" font-size="9" fill="${I}">PRINTING #0142…</text>`);
// receipt strip
const sTop=py0+ph-17,sBot=H+2,w0=pw-56,w1=470;
const wAt=y=>w0+(w1-w0)*Math.pow((y-sTop)/(sBot-sTop),1.15);
o.push(`<path d="M${f(cx-w0/2+10)} ${sTop} L${f(cx+w0/2+10)} ${sTop} L${f(cx+w1/2+22)} ${sBot} L${f(cx-w1/2+22)} ${sBot}Z" fill="${I}"/>`);
o.push(`<path d="M${f(cx-w0/2)} ${sTop} L${f(cx+w0/2)} ${sTop} L${f(cx+w1/2)} ${sBot} L${f(cx-w1/2)} ${sBot}Z" fill="${R}"/>`);
// printed content in perspective
const tAt=k=>sTop+(sBot-sTop)*Math.pow(k,1.7);
const items=['bar','bar','bar2','gap','text:RECEIPTS','text:PICK #0142 · NBA','dash','row','row','row2','dash','text:WON · TRUST 62 → 66','gap','gap','bars','text:STORED ON WALRUS'];
const n=items.length;
items.forEach((it,i)=>{const k0=(i+0.25)/n,k1=(i+0.8)/n;const ya=tAt(k0),yb=tAt(k1);const w=wAt((ya+yb)/2);const lx=cx-w/2+w*0.12,rw=w*0.76;const hh=yb-ya;
  if(it=='bar')o.push(`<rect x="${f(lx)}" y="${f(ya)}" width="${f(rw)}" height="${f(hh*0.7)}" fill="${I}"/>`);
  if(it=='bar2')o.push(`<rect x="${f(lx)}" y="${f(ya)}" width="${f(rw*0.6)}" height="${f(hh*0.7)}" fill="${I}"/>`);
  if(it=='dash')o.push(`<line x1="${f(lx)}" y1="${f(ya+hh/2)}" x2="${f(lx+rw)}" y2="${f(ya+hh/2)}" stroke="${I}" stroke-width="${f(Math.max(1,hh*0.12))}" stroke-dasharray="${f(hh*0.4)} ${f(hh*0.3)}"/>`);
  if(it=='row'||it=='row2'){o.push(`<rect x="${f(lx)}" y="${f(ya+hh*0.25)}" width="${f(rw*(it=='row'?0.4:0.3))}" height="${f(hh*0.35)}" fill="${I}"/><rect x="${f(lx+rw*0.75)}" y="${f(ya+hh*0.25)}" width="${f(rw*0.25)}" height="${f(hh*0.35)}" fill="${I}"/>`)}
  if(it.startsWith('text:'))o.push(`<text x="${cx}" y="${f(yb)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="${f(hh*0.85)}" textLength="${f(rw)}" lengthAdjust="spacingAndGlyphs" fill="${I}">${it.slice(5)}</text>`);
  if(it=='bars'){for(let x=lx,j=0;x<lx+rw;j++){const bw=w*0.006*[2,1,3,1,2,4,1][(j+i)%7];o.push(`<rect x="${f(x)}" y="${f(ya)}" width="${f(bw)}" height="${f(hh*1.9)}" fill="${I}"/>`);x+=bw+w*0.006*[2,3,1,2,3][j%5]}}
});
// WON stamp on strip near viewer
{const y=tAt(11.5/n),w=wAt(y);o.push(`<g transform="rotate(-8 ${f(cx+w*0.22)} ${f(y-30)})"><rect x="${f(cx+w*0.22-70)}" y="${f(y-62)}" width="140" height="54" fill="none" stroke="${C}" stroke-width="5"/><text x="${f(cx+w*0.22)}" y="${f(y-19)}" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="42" fill="${C}">WON</text></g>`)}
// edge highlight lines (paper curl)
o.push(`<path d="M${f(cx-w0/2)} ${sTop} L${f(cx-w1/2)} ${sBot}" stroke="${P}" stroke-width="1.5"/>`);
const DEF2='';
process.stdout.write(`<svg aria-hidden="true" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" width="100%" style="display: block; height: clamp(340px, 42vw, 600px)"><defs>${defs}${DEF2}</defs>${o.join('')}</svg>`);
