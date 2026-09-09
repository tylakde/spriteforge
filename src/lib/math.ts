export const normaliseAngle=(angle:number)=>((angle%360)+360)%360;
export function directionAngles(count:number,front=0):number[]{
  if(![1,4,8,16,32].includes(count)) throw new Error('Unsupported direction count.');
  return Array.from({length:count},(_,i)=>normaliseAngle(front+i*360/count));
}
export function sampleTimes(duration:number,fps:number):number[]{
  if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(fps)||fps<1||fps>60) throw new Error('Animation duration or FPS is invalid.');
  const count=Math.ceil(duration*fps);
  if(count>4096) throw new Error('Animation exceeds 4096 samples. Reduce FPS or split the clip.');
  return Array.from({length:count},(_,i)=>i/fps);
}
export function safeName(name:string):string {
  const clean=name.replace(/\.[^.]+$/,'').normalize('NFKC').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'Asset';
  return /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(clean)?`_${clean}`:clean;
}
export function frameName(asset:string,angle:number,animation='',frame=0):string {
  const degrees=Number(normaliseAngle(angle).toFixed(3)).toString().padStart(3,'0').replace('.','p');
  return `${safeName(asset)}${animation?'_'+safeName(animation):''}_dir${degrees}${animation?'_frame'+String(frame).padStart(4,'0'):''}.png`;
}
export function atlasLayout(count:number,size:number,padding:number,layout:'grid'|'strip',pot=false){
  if(!Number.isInteger(count)||count<1||count>8192||!Number.isInteger(size)||size<1||!Number.isInteger(padding)||padding<0) throw new Error('Invalid atlas dimensions.');
  const stride=size+padding*2; const columns=layout==='strip'?count:Math.ceil(Math.sqrt(count)); const rows=Math.ceil(count/columns);
  const round=(v:number)=>pot?2**Math.ceil(Math.log2(v)):v;
  const width=round(columns*stride),height=round(rows*stride);
  if(width>8192||height>8192||width*height>33554432) throw new Error('Atlas is too large (limit 8192px / 32 megapixels). Reduce cell size, directions or FPS, or use grid layout.');
  return {width,height,columns,rows,rects:Array.from({length:count},(_,i)=>({x:(i%columns)*stride+padding,y:Math.floor(i/columns)*stride+padding,width:size,height:size}))};
}
export const yieldToUI=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
