import { ACESFilmicToneMapping, AnimationMixer, Box3, Color, Scene, SRGBColorSpace, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
import { loadAsset } from '../assets/loadAsset';
import { calculateFraming, renderCamera } from '../renderer/framing';
import { lighting } from '../renderer/lighting';
import { buildAtlas, canvasBlob, makeMetadata } from '../atlas/atlas';
import { sampleTimes, yieldToUI } from '../../lib/math';
import { validateRecipe } from '../recipes/recipes';
import type { AssetSource, Generation, RenderRecipe } from '../../types';
export function outlinePixels(pixels:Uint8ClampedArray,size:number,width:number){
 const alpha=new Uint8Array(size*size);for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x;if(alpha[i]===255)continue;let edge=0;
  for(let dy=-width;dy<=width;dy++)for(let dx=-width;dx<=width;dx++){if(dx*dx+dy*dy>width*width)continue;const xx=x+dx,yy=y+dy;if(xx>=0&&xx<size&&yy>=0&&yy<size)edge=Math.max(edge,alpha[yy*size+xx]);}
  const a=alpha[i]/255,b=edge/255*(1-a),out=a+b;if(!out)continue;
  for(let c=0;c<3;c++)pixels[i*4+c]=(pixels[i*4+c]*a+18*b)/out;
  pixels[i*4+3]=Math.round(out*255);
 }
}
export async function renderSequence(source:AssetSource,rawRecipe:RenderRecipe,clipIndex:number|null,onProgress:(value:number,label:string)=>void,signal?:AbortSignal):Promise<Generation>{
 const recipe=validateRecipe(rawRecipe);const check=()=>{if(signal?.aborted)throw new Error('Generation cancelled.');};
 onProgress(0,'Loading asset');check();const asset=await loadAsset(source);let renderer:WebGLRenderer|undefined,target:WebGLRenderTarget|undefined,mixer:AnimationMixer|undefined;
 const thumbnails:string[]=[];
 try{
  const clip=clipIndex===null?undefined:asset.animations[clipIndex];if(clipIndex!==null&&!clip)throw new Error('Selected animation is missing.');
  const times=clip?sampleTimes(clip.duration,recipe.fps):[0];
  // Validate atlas allocation before scanning animation or allocating a GPU target.
  makeMetadata(source.name,recipe,times,clip?.name||'',0.5,clip?.duration||0);
  const bounds=new Box3();
  if(clip){mixer=new AnimationMixer(asset.root);mixer.clipAction(clip).play();for(let i=0;i<times.length;i++){check();mixer.setTime(times[i]);asset.root.updateMatrixWorld(true);bounds.union(new Box3().setFromObject(asset.root,true));if(i%8===0){onProgress(i/times.length*0.1,'Measuring animation bounds');await yieldToUI();}}}else bounds.copy(asset.bounds);
  const framing=calculateFraming(bounds,recipe);
  const groundInClip=new Vector3(0,0,0).project(renderCamera(framing,recipe,0));
  const metadata=makeMetadata(source.name,recipe,times,clip?.name||'',(1-groundInClip.y)/2,clip?.duration||0);
  const scene=new Scene();scene.add(asset.root,lighting(recipe));
  // Render transparent first, then composite backgrounds after optional silhouette processing.
  renderer=new WebGLRenderer({alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false});renderer.setPixelRatio(1);renderer.setSize(recipe.cellSize,recipe.cellSize,false);renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.setClearColor(new Color(0),0);
  target=new WebGLRenderTarget(recipe.cellSize,recipe.cellSize,{samples:4});target.texture.colorSpace=SRGBColorSpace;
  renderer.setRenderTarget(target);
  const size=recipe.cellSize,readback=new Uint8Array(size*size*4),pixels=new Uint8ClampedArray(size*size*4);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable.');
  const thumb=document.createElement('canvas');thumb.width=thumb.height=96;const thumbCtx=thumb.getContext('2d')!;
  const frames:Blob[]=[];
  for(const frame of metadata.frames){
   check();if(mixer){mixer.setTime(frame.time);asset.root.updateMatrixWorld(true);}
   const camera=renderCamera(framing,recipe,frame.directionDegrees);renderer.setRenderTarget(target);renderer.render(scene,camera);
   await renderer.readRenderTargetPixelsAsync(target,0,0,size,size,readback);
   // WebGL origin is bottom-left, PNG origin is top-left. Render targets store associated alpha.
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){const src=((size-y-1)*size+x)*4,dst=(y*size+x)*4,a=readback[src+3];pixels[dst+3]=a;for(let c=0;c<3;c++)pixels[dst+c]=a?Math.min(255,Math.round(readback[src+c]*255/a)):0;}
   if(recipe.outlineEnabled)outlinePixels(pixels,size,recipe.outlineWidth);
   ctx.clearRect(0,0,size,size);ctx.putImageData(new ImageData(pixels,size,size),0,0);
   if(recipe.background==='solid'){ctx.globalCompositeOperation='destination-over';ctx.fillStyle=recipe.backgroundColor;ctx.fillRect(0,0,size,size);ctx.globalCompositeOperation='source-over';}
   frames.push(await canvasBlob(canvas));thumbCtx.clearRect(0,0,96,96);thumbCtx.drawImage(canvas,0,0,96,96);thumbnails.push(URL.createObjectURL(await canvasBlob(thumb)));
   onProgress(0.1+0.8*(frame.index+1)/metadata.frames.length,`Rendering ${frame.index+1} / ${metadata.frames.length}`);await yieldToUI();
  }
  check();onProgress(0.93,'Packing atlas');const atlas=await buildAtlas(frames,metadata);canvas.width=canvas.height=thumb.width=thumb.height=1;
  onProgress(1,'Ready to export');return {sourceId:source.id,recipeKey:JSON.stringify(recipe),frames,thumbnails,atlas,metadata};
 }catch(error){thumbnails.forEach(URL.revokeObjectURL);throw error;}finally{mixer?.stopAllAction();mixer?.uncacheRoot(asset.root);target?.dispose();renderer?.dispose();renderer?.forceContextLoss();asset.dispose();}
}
export function disposeGeneration(generation:Generation|null){generation?.thumbnails.forEach(URL.revokeObjectURL);}
