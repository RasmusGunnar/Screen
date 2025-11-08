window.SUBRA_DEFAULTS = {
  employees: [
    {
      id: 'emp-anna-andersen',
      firstName: 'Anna',
      lastName: 'Andersen',
      role: 'Produktionsleder',
      department: 'Produktion',
      contact: 'anna.andersen@subra.dk',
      photo:
        'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=200&q=80',
      status: 'onsite',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Ankom 08:02',
    },
    {
      id: 'emp-bjorn-larsen',
      firstName: 'Bjørn',
      lastName: 'Larsen',
      role: 'Procesoperatør',
      department: 'Produktion',
      contact: '+45 33 11 22 33',
      photo:
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=facearea&w=200&q=80',
      status: 'remote',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Arbejder hjemme hele dagen',
    },
    {
      id: 'emp-nora-holm',
      firstName: 'Nora',
      lastName: 'Holm',
      role: 'Kvalitetsinspektør',
      department: 'Analyse og Inspection',
      contact: 'nora.holm@subra.dk',
      photo:
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&w=200&q=80',
      status: 'away',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Barsel til 31/10',
      absence: {
        from: new Date().toISOString().split('T')[0],
        to: '2024-10-31',
      },
    },
    {
      id: 'emp-jens-iversen',
      firstName: 'Jens',
      lastName: 'Iversen',
      role: 'R&D-direktør',
      department: 'R&D',
      contact: 'jens.iversen@subra.dk',
      photo:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&w=200&q=80',
      status: 'onsite',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Ankom 07:48',
    },
    {
      id: 'emp-ulla-krogh',
      firstName: 'Ulla',
      lastName: 'Krogh',
      role: 'Lead Engineer',
      department: 'R&D',
      contact: 'ulla.krogh@subra.dk',
      photo:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=facearea&w=200&q=80',
      status: 'onsite',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Ankom 08:15',
    },
    {
      id: 'emp-mikkel-foss',
      firstName: 'Mikkel',
      lastName: 'Foss',
      role: 'Prototypetekniker',
      department: 'R&D',
      contact: 'mikkel.foss@subra.dk',
      photo:
        'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=facearea&w=200&q=80',
      status: 'remote',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Opsætning af ny release hjemmefra',
    },
    {
      id: 'emp-signe-nygaard',
      firstName: 'Signe',
      lastName: 'Nygaard',
      role: 'HR-chef',
      department: 'Administration',
      contact: 'signe.nygaard@subra.dk',
      photo:
        'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=200&q=80',
      status: 'onsite',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Ankom 08:20',
    },
    {
      id: 'emp-louise-kaspersen',
      firstName: 'Louise',
      lastName: 'Kaspersen',
      role: 'HR-partner',
      department: 'Administration',
      contact: 'louise.kaspersen@subra.dk',
      photo:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&w=200&q=80',
      status: 'onsite',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Ankom 08:05',
    },
    {
      id: 'emp-emil-soerensen',
      firstName: 'Emil',
      lastName: 'Sørensen',
      role: 'Servicekoordinator',
      department: 'Værksted',
      contact: 'emil.soerensen@subra.dk',
      photo:
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&w=200&q=80',
      status: 'away',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Sygdom - forventet tilbage 25/09',
      absence: {
        from: new Date().toISOString().split('T')[0],
        to: '2024-09-25',
      },
    },
  ],
  slides: [
    {
      id: 'slide-1',
      theme: 'fjord',
      headline: 'Velkommen til SUBRA',
      description: 'Registrer ankomst og afgang direkte på skærmen',
      image:
        'https://images.unsplash.com/photo-1529336953121-4974abd5ea47?auto=format&fit=crop&w=1080&q=80',
    },
    {
      id: 'slide-2',
      theme: 'aurora',
      headline: 'Nordisk ro, effektiv drift',
      description: 'Få fuldt overblik over medarbejdere og gæster',
      image:
        'https://images.unsplash.com/photo-1526481280695-3c4699d78ff0?auto=format&fit=crop&w=1080&q=80',
    },
    {
      id: 'slide-3',
      theme: 'ocean',
      headline: 'Tryghed og compliance',
      description: 'Politikker, logning og evakueringslister samlet ét sted',
      image:
        'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1080&q=80',
    },
  ],
  qrLinks: {
    employee: 'https://subra-kiosk.example.com/employee',
    guest: 'https://subra-kiosk.example.com/guest',
  },
  policyLinks: {
    nda: 'https://subra-kiosk.example.com/assets/subra-nda.pdf',
  },
};
