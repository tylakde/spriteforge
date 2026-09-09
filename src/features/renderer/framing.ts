import { Box3, MathUtils, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import type { RenderRecipe } from '../../types';
export function calculateFraming(bounds:Box3,recipe:RenderRecipe){
 const center=bounds.getCenter(new Vector3()); const radius=Math.max(...[bounds.min.x,bounds.max.x].flatMap(x=>[bounds.min.z,bounds.max.z].map(z=>Math.hypot(x,z))));
 const elevation=MathUtils.degToRad(recipe.cameraElevation); const height=bounds.max.y-bounds.min.y;
 const vertical=height*Math.abs(Math.cos(elevation))+2*radius*Math.abs(Math.sin(elevation));
 const padding=recipe.paddingPercent/100+ (recipe.outlineEnabled?recipe.outlineWidth/recipe.cellSize:0);
 const usable=1-2*padding;
 let span=Math.max(2*radius,vertical,0.001)/usable;
 let targetY=center.y*Math.cos(elevation);
 if(recipe.anchor==='ground'){
  // Reserve space below the projected origin for the model's depth; ground pivot is stable across the clip.
  const low=bounds.min.y*Math.cos(elevation)-radius*Math.abs(Math.sin(elevation));
  const high=bounds.max.y*Math.cos(elevation)+radius*Math.abs(Math.sin(elevation));
  span=Math.max(span,(high-low)/usable);
  targetY=(high+low)/2;
 }
 const target=new Vector3(0,targetY/Math.max(Math.cos(elevation),0.017),0);
 const sphere=bounds.getBoundingSphere({center:new Vector3(),radius:0} as import('three').Sphere).radius;
 // Perspective uses a conservative depth allowance for every yaw to avoid close-side clipping.
 const distance=recipe.projection==='perspective'?span/(2*Math.tan(MathUtils.degToRad(recipe.perspectiveFov/2)))+sphere*2:span*3+sphere*2;
 if(recipe.projection==='perspective')span=2*distance*Math.tan(MathUtils.degToRad(recipe.perspectiveFov/2));
 return {target,span,distance,pivotY:0.5+targetY/span};
}
export function renderCamera(framing:ReturnType<typeof calculateFraming>,recipe:RenderRecipe,angle:number){
 const {span,distance,target}=framing;
 const near=Math.max(0.0001,distance/10000),far=distance*10+span*10;
 const camera=recipe.projection==='orthographic'?new OrthographicCamera(-span/2,span/2,span/2,-span/2,near,far):new PerspectiveCamera(recipe.perspectiveFov,1,near,far);
 const yaw=MathUtils.degToRad(angle),elevation=MathUtils.degToRad(recipe.cameraElevation);
 camera.position.copy(target).add(new Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)).multiplyScalar(distance));
 camera.lookAt(target);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();return camera;
}
