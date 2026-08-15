import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppState } from '../types';
import { calculateStorageUsage, FACILITY_STORAGE_KEYS, getAllProjects, loadProject, saveProject } from './storageUtils';

class MemoryStorage {
  private values=new Map<string,string>();
  get length(){return this.values.size;}
  key(index:number){return [...this.values.keys()][index]??null;}
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){this.values.set(key,String(value));}
  removeItem(key:string){this.values.delete(key);}
  clear(){this.values.clear();}
}
const state:AppState={projectSchemaVersion:11,projectName:'Fixture Facility',projectFormat:'facility-construction',phase:1,topic:null,plannedScenes:[],sceneDirections:[],masterVoiceoverScript:'',voiceoverTranscription:null,t2vPromptProfile:'omni-flash',visualPrompts:[],demoState:'idle',demoScenes:[],demoSceneNumbers:[]};

test('facility storage namespace never uses assembly_line keys',()=>{
  assert.deepEqual(Object.values(FACILITY_STORAGE_KEYS),['facility_engine_save','facility_engine_settings','facility_engine_projects','facility_engine_project_']);
  assert.ok(Object.values(FACILITY_STORAGE_KEYS).every(key=>!key.startsWith('assembly_line_')));
});

test('project save/load/index uses only facility keys and leaves unrelated storage untouched',()=>{
  const memory=new MemoryStorage();Object.assign(globalThis,{localStorage:memory});
  memory.setItem('assembly_line_projects','original-app-data');memory.setItem('unrelated_key','keep-me');
  const id=saveProject(state);
  assert.ok(memory.getItem(`${FACILITY_STORAGE_KEYS.projectPrefix}${id}`));assert.equal(loadProject(id)?.projectFormat,'facility-construction');assert.equal(getAllProjects().length,1);
  assert.equal(memory.getItem('assembly_line_projects'),'original-app-data');assert.equal(memory.getItem('unrelated_key'),'keep-me');
  assert.ok(calculateStorageUsage().usedKb>0);
});
