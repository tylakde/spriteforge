import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { atlasLayout,directionAngles,frameName,safeName,sampleTimes } from '../src/lib/math';
import { baseRecipe,validateRecipe } from '../src/features/recipes/recipes';
import { makeMetadata } from '../src/features/atlas/atlas';
import { calculateFraming,renderCamera } from '../src/features/renderer/framing';
import { outlinePixels } from '../src/features/generation/generate';
describe('deterministic output contract',()=>{
 it('generates offset and wrapped directions',()=>{expect(directionAngles(8)).toEqual([0,45,90,135,180,225,270,315]);expect(directionAngles(4,315)).toEqual([315,45,135,225]);expect(()=>directionAngles(3)).toThrow();});
 it('validates recipe values rather than coercing unsafe data',()=>{expect(validateRecipe(baseRecipe)).toEqual(baseRecipe);for(const value of [{cellSize:999},{fps:NaN},{outlineEnabled:'false'},{anchor:'foot'},{backgroundColor:'red'},{name:''},{atlasPadding:1.5}])expect(()=>validateRecipe({...baseRecipe,...value})).toThrow();});
 it('sanitises portable filenames including Windows device names',()=>{expect(safeName('../../Sword:elite.glb')).toBe('Sword_elite');expect(safeName('CON.glb')).toBe('_CON');expect(safeName('🔥')).toBe('Asset');expect(frameName('Goblin.glb',45,'Idle',3)).toBe('Goblin_Idle_dir045_frame0003.png');expect(frameName('X',11.25)).toBe('X_dir11p25.png');});
 it('samples from zero without a duplicate loop endpoint',()=>{expect(sampleTimes(1,4)).toEqual([0,.25,.5,.75]);expect(sampleTimes(.3,12)).toEqual([0,1/12,2/12,3/12]);expect(()=>sampleTimes(0,12)).toThrow();expect(()=>sampleTimes(1,Infinity)).toThrow();});
 it('packs padded nonoverlapping rectangles and refuses excessive allocations',()=>{const l=atlasLayout(8,256,2,'grid');expect(l).toMatchObject({width:780,height:780,columns:3,rows:3});expect(l.rects[3]).toEqual({x:2,y:262,width:256,height:256});expect(atlasLayout(4,64,0,'strip',true).width).toBe(256);expect(()=>atlasLayout(32,1024,2,'strip')).toThrow();expect(()=>atlasLayout(8192,256,0,'grid')).toThrow();});
 it('exports exact direction-major frame, UV and animation records',()=>{const m=makeMetadata('Goblin.glb',baseRecipe,[0,.5],'Idle',.9,1);expect(m.version).toBe(1);expect(m.frames).toHaveLength(16);expect(m.frames[3]).toMatchObject({index:3,directionDegrees:45,animationFrame:1,time:.5});expect(m.atlas.file).toBe('Goblin_atlas.png');expect(m.frames[3].uv.u0).toBe(m.frames[3].rect.x/m.atlas.width);expect(m.animations.Idle.frameCount).toBe(2);expect(m.anchor.y).toBe(.9);});
 it('fits the complete bounds at every direction with fixed framing',()=>{const bounds=new Box3(new Vector3(-2,0,-1),new Vector3(2,5,1));for(const projection of ['orthographic','perspective'] as const){const r={...baseRecipe,projection};const f=calculateFraming(bounds,r);for(const angle of directionAngles(32)){const c=renderCamera(f,r,angle);for(const x of [-2,2])for(const y of [0,5])for(const z of [-1,1]){const v=new Vector3(x,y,z).project(c);expect(Math.abs(v.x)).toBeLessThan(1);expect(Math.abs(v.y)).toBeLessThan(1);expect(Math.abs(v.z)).toBeLessThan(1);}}}});
 it('adds an alpha silhouette without filling the transparent background',()=>{const p=new Uint8ClampedArray(5*5*4);p.set([100,200,100,255],(2*5+2)*4);outlinePixels(p,5,1);expect(p[(2*5+1)*4+3]).toBe(255);expect(p[3]).toBe(0);expect(p[(2*5+2)*4]).toBe(100);});
});
