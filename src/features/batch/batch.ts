import type { AssetSource, RenderRecipe } from '../../types';
import { renderSequence, disposeGeneration } from '../generation/generate';
import { exportGeneration, type ExportMode } from '../export/export';
export interface QueueItem {id:string;name:string;status:'waiting'|'rendering'|'done'|'error';detail:string;progress:number}
export async function runBatch(sources:AssetSource[],recipe:RenderRecipe,mode:ExportMode,directory:string|null,animated:boolean,onUpdate:(item:QueueItem)=>void,signal:AbortSignal){
 for(const source of sources){if(signal.aborted)break;let generation=null;
  try{generation=await renderSequence(source,recipe,animated?0:null,(progress,detail)=>onUpdate({id:source.id,name:source.name,status:'rendering',progress,detail}),signal);
   if(signal.aborted)break;const path=await exportGeneration(generation,mode,directory);onUpdate({id:source.id,name:source.name,status:'done',detail:path||'Export cancelled',progress:1});
  }catch(e){onUpdate({id:source.id,name:source.name,status:'error',detail:e instanceof Error?e.message:'Batch item failed.',progress:0});}finally{disposeGeneration(generation);}
 }
}
