import assert from 'node:assert/strict';
import test from 'node:test';
import type { FullProjectData } from '../types';
import { FACILITY_STORAGE_KEYS, isQuotaExceededError, projectByteSize, ProjectStorageError, summarizeProject } from './storageUtils';

const project:FullProjectData={
  projectSchemaVersion:11,id:'fixture-project',projectName:'Fixture Facility',projectFormat:'facility-construction',phase:3,
  topic:null,plannedScenes:[],sceneDirections:[],masterVoiceoverScript:'',voiceoverTranscription:null,t2vPromptProfile:'omni-flash',
  visualPrompts:[{number:1,action_description:'action',video_prompt:'prompt',voiceover:'voiceover',stock_keywords:'keywords'}],
  demoState:'idle',demoScenes:[],demoSceneNumbers:[],createdAt:'2026-01-01T00:00:00.000Z',savedAt:'2026-01-02T00:00:00.000Z',
};

test('legacy facility keys remain stable for one-time migration',()=>{
  assert.deepEqual(Object.values(FACILITY_STORAGE_KEYS),['facility_engine_save','facility_engine_settings','facility_engine_projects','facility_engine_project_']);
  assert.ok(Object.values(FACILITY_STORAGE_KEYS).every(key=>!key.startsWith('assembly_line_')));
});

test('project summaries include accurate metadata and serialized size',()=>{
  const summary=summarizeProject(project);
  assert.equal(summary.id,'fixture-project');
  assert.equal(summary.sceneCount,1);
  assert.equal(summary.sizeBytes,projectByteSize(project));
  assert.ok((summary.sizeBytes||0)>0);
});

test('quota failures are normalized across browser error shapes',()=>{
  assert.equal(isQuotaExceededError(new ProjectStorageError('full','quota')),true);
  const browserStyle=new Error('Storage quota exceeded');browserStyle.name='QuotaExceededError';
  assert.equal(isQuotaExceededError(browserStyle),true);
  assert.equal(isQuotaExceededError(new Error('network failed')),false);
});
