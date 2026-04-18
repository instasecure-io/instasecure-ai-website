export interface Author {
  id: string;
  name: string;
  title: string;
  bio: string;
  linkedin?: string;
  twitter?: string;
}

export const AUTHORS: Record<string, Author> = {
  'rupesh-mishra': {
    id: 'rupesh-mishra',
    name: 'Rupesh Mishra',
    title: 'Founder & CEO, InstaSecure',
    bio: 'Building the preventive-cloud-security platform. Previously led cloud security and identity platforms at Netflix and LinkedIn.',
    linkedin: 'https://www.linkedin.com/in/mishra-rupesh/',
  },
};
