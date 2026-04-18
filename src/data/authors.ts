export interface Author {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatar?: string;
  linkedin?: string;
  twitter?: string;
}

export const AUTHORS: Record<string, Author> = {
  'rupesh-mishra': {
    id: 'rupesh-mishra',
    name: 'Rupesh Mishra',
    title: 'Founder & CEO, InstaSecure',
    bio: 'Building the preventive-cloud-security platform. Previously led cloud security and identity platforms at Netflix and LinkedIn.',
    avatar: '/authors/rupesh-mishra.jpg',
    linkedin: 'https://www.linkedin.com/in/rupeshmishra/',
  },
};
