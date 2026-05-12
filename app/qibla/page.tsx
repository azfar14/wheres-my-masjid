import { useEffect, useState } from 'react';

// Coordinates of the Kaaba (Mecca)
const KAABA_LAT = 21.4225; // Latitude of the Kaaba
const KAABA_LON = 39.8262; // Longitude of the Kaaba

// Function to calculate Qibla direction from the user's location
const calculateQibla = (userLat: number, userLon: number) => {
    const rad = Math.PI / 180;
    const phi1 = userLat * rad;
    const phi2 = KAABA_LAT * rad;
    const lambda1 = userLon * rad;
    const lambda2 = KAABA_LON * rad;

    const y = Math.sin(lambda2 - lambda1);
    const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(lambda2 - lambda1);

    const qiblaDirection = Math.atan2(y, x) * (180 / Math.PI); // In degrees
    return qiblaDirection;
};

const QiblaDetector: React.FC = () => {
    const [deviceOrientation, setDeviceOrientation] = useState<number>(0); // For the compass rotation
    const [qiblaDirection, setQiblaDirection] = useState<number | null>(null); // For the Qibla direction

    // Function to rotate the compass element
    const rotateCompass = (angle: number) => {
        const compassElement = document.getElementById("compass")!;
        compassElement.style.transform = `rotate(${angle}deg)`;
    };

    // Get the user's location and calculate Qibla direction
    const getLocationAndSetQibla = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                const direction = calculateQibla(userLat, userLon);
                setQiblaDirection(direction);
                rotateCompass(direction); // Point compass to Qibla
            });
        }
    };

    // Listen for device orientation changes (mobile)
    useEffect(() => {
        if (window.DeviceOrientationEvent) {
            window.addEventListener("deviceorientation", (event) => {
                const alpha = event.alpha; // Device orientation angle (compass)
                setDeviceOrientation(alpha || 0); // Update device orientation state
                if (qiblaDirection !== null) {
                    rotateCompass(qiblaDirection); // Rotate compass to Qibla direction
                }
            }, false);
        }

        getLocationAndSetQibla(); // Get location and set Qibla when component mounts

        return () => {
            // Clean up event listener when component unmounts
            if (window.DeviceOrientationEvent) {
                window.removeEventListener("deviceorientation", () => {});
            }
        };
    }, [qiblaDirection]);

    return (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <h1>Qibla Detector</h1>
            <div
                id="compass"
                style={{
                    width: '200px',
                    height: '200px',
                    border: '10px solid black',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f0f0f0',
                    transformOrigin: 'center',
                    transition: 'transform 0.1s ease',
                }}
            >
                <div
                    id="qibla-icon"
                    style={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: 'gold',
                        borderRadius: '50%',
                    }}
                ></div>
            </div>
            {qiblaDirection !== null && (
                <p>Qibla is at {qiblaDirection.toFixed(2)}° from your location.</p>
            )}
        </div>
    );
};

export default QiblaDetector;