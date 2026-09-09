import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { baseRecipe, builtins, validateRecipe } from '../features/recipes/recipes';
import type { RenderRecipe } from '../types';
interface State { recipe:RenderRecipe; presets:RenderRecipe[]; grid:boolean; previewBackground:'checker'|'solid'; outputMode:'all'|'atlas'|'frames';
 update:(patch:Partial<RenderRecipe>)=>void; setRecipe:(recipe:RenderRecipe)=>void; savePreset:(name:string)=>void; renamePreset:(name:string)=>void; deletePreset:(name:string)=>void; reset:()=>void; preferences:(patch:Partial<Pick<State,'grid'|'previewBackground'|'outputMode'>>)=>void; }
export const useStore=create<State>()(persist((set,get)=>({recipe:{...baseRecipe},presets:builtins.map(x=>({...x})),grid:true,previewBackground:'checker',outputMode:'all',
 update:patch=>set({recipe:validateRecipe({...get().recipe,...patch})}),setRecipe:recipe=>set({recipe:validateRecipe(recipe)}),
 savePreset:name=>{const recipe=validateRecipe({...get().recipe,name:name.trim()});set({recipe,presets:[...get().presets.filter(p=>p.name!==recipe.name),recipe]});},
 renamePreset:name=>{const previous=get().recipe.name;const recipe=validateRecipe({...get().recipe,name:name.trim()});set({recipe,presets:[...get().presets.filter(p=>p.name!==previous&&p.name!==recipe.name),recipe]});},
 deletePreset:name=>set({presets:get().presets.filter(p=>p.name!==name)}),reset:()=>set({presets:[...builtins],recipe:{...baseRecipe}}),preferences:patch=>set(patch)
}),{name:'spriteforge-v1',partialize:({recipe,presets,grid,previewBackground,outputMode})=>({recipe,presets,grid,previewBackground,outputMode}),merge:(saved,current)=>{
 try { const s=saved as State;return {...current,recipe:validateRecipe(s.recipe),presets:s.presets.map(validateRecipe),grid:typeof s.grid==='boolean'?s.grid:true,previewBackground:s.previewBackground==='solid'?'solid':'checker',outputMode:['all','atlas','frames'].includes(s.outputMode)?s.outputMode:'all'} as State; } catch {return current;}
}}));
