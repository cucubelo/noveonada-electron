interface Window {
  electronAPI?: {
    loadStream: (channelId: string) => void;
  };
}