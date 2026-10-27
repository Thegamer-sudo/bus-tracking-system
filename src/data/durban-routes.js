// Real Durban bus routes with approximate coordinates
export const DURBAN_ROUTES = {
  routes: [
    {
      id: '1',
      name: 'Route 100',
      from: 'Musgrave Centre',
      to: 'Durban Station',
      fare: 12.50,
      stops: [
        { name: 'Musgrave Centre', lat: -29.8476, lng: 31.0023, order: 1 },
        { name: 'Berea Road', lat: -29.8460, lng: 31.0060, order: 2 },
        { name: 'Pine Street', lat: -29.8440, lng: 31.0100, order: 3 },
        { name: 'Durban Station', lat: -29.8405, lng: 31.0230, order: 4 }
      ],
      schedule: {
        weekday: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
        saturday: ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00'],
        sunday: ['08:00', '10:00', '12:00', '14:00', '16:00']
      }
    },
    {
      id: '2',
      name: 'Route 200',
      from: 'UKZN Howard College',
      to: 'Gateway Theatre of Shopping',
      fare: 25.00,
      stops: [
        { name: 'UKZN Howard College', lat: -29.8680, lng: 30.9770, order: 1 },
        { name: 'Rick Turner Road', lat: -29.8600, lng: 30.9800, order: 2 },
        { name: 'Umgeni Road', lat: -29.8400, lng: 30.9900, order: 3 },
        { name: 'Gateway', lat: -29.7220, lng: 31.0680, order: 4 }
      ],
      schedule: {
        weekday: ['06:30', '07:30', '08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'],
        saturday: ['07:30', '09:30', '11:30', '13:30', '15:30'],
        sunday: ['08:30', '10:30', '12:30', '14:30']
      }
    },
    {
      id: '3',
      name: 'Route 300',
      from: 'Durban City Hall',
      to: 'uShaka Marine World',
      fare: 8.00,
      stops: [
        { name: 'City Hall', lat: -29.8581, lng: 31.0252, order: 1 },
        { name: 'Point Road', lat: -29.8650, lng: 31.0350, order: 2 },
        { name: 'Battery Beach', lat: -29.8700, lng: 31.0400, order: 3 },
        { name: 'uShaka', lat: -29.8750, lng: 31.0450, order: 4 }
      ],
      schedule: {
        weekday: ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
        saturday: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
        sunday: ['09:00', '11:00', '13:00', '15:00']
      }
    }
  ]
};