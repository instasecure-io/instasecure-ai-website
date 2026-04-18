export interface VideoMeta {
  id: string;
  title: string;
  description: string;
  uploadDate: string;
  duration: string;
}

export const VIDEOS: Record<string, VideoMeta> = {
  ujfjOpjG_zU: {
    id: 'ujfjOpjG_zU',
    title: 'Proactive Cloud Security: Tackling Credential Theft with InstaSecure',
    description: 'Walkthrough of how InstaSecure builds AWS Data Perimeters to tackle credential theft — blocking compromised credentials even when attackers have them.',
    uploadDate: '2026-01-22',
    duration: 'PT7M29S',
  },
  D3pmyxFWmC4: {
    id: 'D3pmyxFWmC4',
    title: 'InstaSecure: Enhancing AWS Cloud Security with InstaWorkforce',
    description: 'Product walkthrough showing how InstaWorkforce maps human access across IdP and AWS Identity Center, and computes true end-to-end permissions.',
    uploadDate: '2026-01-22',
    duration: 'PT5M36S',
  },
};
