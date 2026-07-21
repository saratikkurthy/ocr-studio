import type { Project } from "../services/projectStorage";
export type CollectionStatistics = { projectCount:number; documents:number; pages:number; words:number; storageBytes:number; publishedDocuments:number; averageConfidence:number; reviewPercent:number; };
export type Collection = { id:string; name:string; description:string; institution:string; owner:string; license:string; languages:string[]; tags:string[]; color:string; icon:string; createdAt:string; updatedAt:string; projects:Project[]; statistics:CollectionStatistics; };
