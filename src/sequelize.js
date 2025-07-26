const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

try {
  // PostgreSQL configuration using individual credentials (no DATABASE_URL)
  sequelize = new Sequelize(
    process.env.PG_DATABASE || 'defaultdb',
    process.env.PG_USER || 'avnadmin', 
    process.env.PG_PASSWORD || 'AVNS_9_VXJQr8Fti4zJCCaMI',
    {
      host: process.env.PG_HOST || 'pg-da5a310-alchemytech-0ec7.h.aivencloud.com',
      port: process.env.PG_PORT || 23429,
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
          ca: process.env.PG_SSL_CA || `-----BEGIN CERTIFICATE-----
MIIEUDCCArigAwIBAgIUbTjR5/C+csGHNBrkZg0+ygas78UwDQYJKoZIhvcNAQEMBQAwQDE+MDwGA1UEAww1ZjNjYmIyNDMtNWY2Ny00OGI1LWEwY2ItYjAxZDljZTE0ZWUzIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwNzI0MDUzODI4WhcNMzUwNzIyMDUzODI4WjBAMT4wPAYDVQQDDDVmM2NiYjI0My01ZjY3LTQ4YjUtYTBjYi1iMDFkOWNlMTRlZTMgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAK/OLVQA9tnyxqJKSy3eC7geHhkIcpJhyXTeQGIAvFy3yAz9eZ0uY2DwWNkvLJF83dY8drHxDM2Ri3HeGdxoEtysOGr7gL0bkCxslTwTiX9xlaWA8llnIP53ahdAp19szKCNEN648UjtKjPU4D/+XC4XXXEeGKVWateSYI5Y/UvlW2zJbDDO2wrXv0/EtfpN1paIFam3fYJzAadIZUs0HfDcZwSG9o+rsMT8MXrhtAOfQO69fpjwd9h+EoVXxv4hChCPYteDX/blWpRww69lnggbRW6NhJH4xA4+gz4F/DfSDH82oMg0R3WQoNY9krmgPXtm/hDVbhVp7VPaf1q4dpX68e92MVTW9XUjH1L+rPLxlp/AtuG+QkhQt4yu18Vg3BzO3f74Jo2NDlHsgAWXhncI542WJuD78KDyL7+zueycLz7d31ezuYqtJyvUGpFBjl18LHfYOcvwBftiqAhPb3ECjmWnCe2eP0PUjXKAuWlgIzHQIMgYk255A6qPMGn+TwIDAQABo0IwQDAdBgNVHQ4EFgQUChPp/bAY2HLfZV+t6+9EwkF1vL8wEgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAK+jPKv7xoGjIGxPJZ4OoewsAfEKmuZFirpcuuNshnJUAfeKh3pY1nufLhVNeitm/984qDu/xJKT1tlDdaqoXOmRponzIuAqlfU/vZlJE/249a4hnXuRXgAaOYZCqFHRbSCFVS+a0bbbWVSOLe9XJ4H3Jlgz4TO8Z1u5lLARK17vrylAeKq06Lix8OJijlPJgfOHB7MpqX9QDN7cpUkp+Kxi4/mvb/gYF/zEZzLP5KDB6wUgUv/pDme3Vv8SjTwpLQMPTv074oBiqRYLokz/cI1gCj61WmWRUeFJtoU5G3JWFw9+t6wCWAukpCa+mYwKO8Y9U/ek6BfHCQ41vtvfo/2MNoKp38oRnpSJ+oDeNDogX0QQEiOQKNSTch0WG+GZCVetFw2lMpxtA9xLAcOJr4oAWi8xvuow30oF7dPWLzi96MHBdQjQN4WklixvSNlUmQdyVozdhgt0ZSQ5a91jFvUm0w7MKs6//iroaOdD0EfW4V6z958Ikqa5joZcRsfUJQ==
-----END CERTIFICATE-----`
        }
      }
    }
  );
} catch (error) {
  console.error('Error initializing Sequelize:', error);
  throw new Error('Database configuration failed');
}

module.exports = sequelize;
