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
    bio: 'Distinguished Engineer and former CTO with two decades of building category-defining cybersecurity products — firewalls, Unified Threat Management, Web Application Firewalls, DDoS protection, application load balancers, and Zero Trust microsegmentation — across Cisco, Juniper Networks, A10 Networks, and Illumio. Holds multiple patents in network and cloud security.',
    avatar: '/authors/rupesh-mishra.jpg',
    linkedin: 'https://www.linkedin.com/in/rupeshmishra/',
  },
};
