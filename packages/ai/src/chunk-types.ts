export type ChunkType = 'feedback' | 'decision' | 'action_item' | 'reflection' | 'event' | 'general';

export interface MemoryChunkMetadata {
  date: string;            
  sourceType: 'diary' | 'calendar' | 'gmail';
  sourceId: string;
  chunkIndex: number;      
  chunkType: ChunkType;
  people?: string[];       
  projects?: string[];    
  tags?: string[];
  importance?: number;    
  sourceTitle?: string;
  sourceUrl?: string;
  startOffset?: number;    
  endOffset?: number;
  calendarEventId?: string; 
}

export interface SemanticChunk {
  text: string;
  metadata: Partial<MemoryChunkMetadata>;
}