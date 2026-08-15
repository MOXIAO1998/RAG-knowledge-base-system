export interface SystemConfigData {
  retrieval: {
    topN: number
    topK: number
    similarityThreshold: number
    rerankModel: string
    maxChunkLength: number
  }
  cache: {
    ttlSeconds: number
    similarityThreshold: number
    maxCacheSize: number
  }
  rateLimit: {
    userPerMinute: number
    qaPerMinute: number
    uploadPerMinute: number
    llmConcurrency: number
  }
  model: {
    llmModel: string
    embeddingModel: string
    smallModel: string
    maxRetries: number
    timeout: number
  }
}

export const systemConfig: SystemConfigData = {
  retrieval: {
    topN: 50,
    topK: 10,
    similarityThreshold: 0.7,
    rerankModel: 'bge-reranker-v2-m3',
    maxChunkLength: 1024,
  },
  cache: {
    ttlSeconds: 3600,
    similarityThreshold: 0.95,
    maxCacheSize: 10000,
  },
  rateLimit: {
    userPerMinute: 30,
    qaPerMinute: 60,
    uploadPerMinute: 10,
    llmConcurrency: 5,
  },
  model: {
    llmModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-large',
    smallModel: 'gpt-3.5-turbo',
    maxRetries: 3,
    timeout: 30,
  },
}
