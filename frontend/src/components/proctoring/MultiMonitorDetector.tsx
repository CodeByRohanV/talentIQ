import React, { useState, useEffect } from 'react';
import { MonitorX, MonitorCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface MultiMonitorDetectorProps {
  children: React.ReactNode;
}

const MultiMonitorDetector: React.FC<MultiMonitorDetectorProps> = ({ children }) => {
  const [monitorCount, setMonitorCount] = useState(1);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionRequested, setPermissionRequested] = useState(false);

  const checkMonitors = async () => {
    if (!('getScreenDetails' in window)) {
      setIsSupported(false);
      return;
    }

    try {
      // Request access to window management
      const screenDetails = await (window as any).getScreenDetails();
      setHasPermission(true);
      setMonitorCount(screenDetails.screens.length);

      // Listen for screen changes
      screenDetails.addEventListener('screenschange', () => {
        setMonitorCount(screenDetails.screens.length);
      });
    } catch (error) {
      console.error('Error getting screen details:', error);
      setHasPermission(false);
    } finally {
      setPermissionRequested(true);
    }
  };

  useEffect(() => {
    if ('getScreenDetails' in window) {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'window-management' as any }).then((result) => {
          if (result.state === 'granted') {
            checkMonitors();
          } else if (result.state === 'denied') {
            setPermissionRequested(true);
            setHasPermission(false);
          } else {
             // prompt state, wait for user to click
          }
        }).catch(() => {
          // ignore error
        });
      }
    } else {
      setIsSupported(false);
    }
  }, []);

  const BlockingOverlay = ({ icon: Icon, title, description, childrenNode, variant = "default" }: any) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <Card className={`max-w-md w-full shadow-2xl ${variant === "destructive" ? "border-destructive" : ""}`}>
        <CardHeader className="text-center pb-2">
          <div className={`mx-auto mb-4 p-3 rounded-full ${variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <Icon className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base mt-2">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-4">
          {childrenNode}
        </CardContent>
      </Card>
    </div>
  );

  if (!isSupported) {
    return (
      <BlockingOverlay
        icon={AlertTriangle}
        variant="destructive"
        title="Browser Not Supported"
        description="Your browser does not support monitor detection. Please use a Chromium-based browser (like Google Chrome or Microsoft Edge) for a secure session."
      />
    );
  }

  if (permissionRequested && !hasPermission) {
    return (
      <BlockingOverlay
        icon={MonitorCheck}
        title="Permission Required"
        description="This assessment requires permission to check your monitor setup to ensure a secure environment."
        childrenNode={<Button onClick={checkMonitors} size="lg" className="w-full mt-2">Grant Permission</Button>}
      />
    );
  }

  if (!permissionRequested && !hasPermission) {
    return (
      <BlockingOverlay
        icon={MonitorCheck}
        title="Environment Check"
        description="We need to verify your display environment before proceeding with the assessment."
        childrenNode={<Button onClick={checkMonitors} size="lg" className="w-full mt-2">Start Check</Button>}
      />
    );
  }

  if (monitorCount > 1) {
    return (
      <BlockingOverlay
        icon={MonitorX}
        variant="destructive"
        title="Multiple Monitors Detected"
        description={`You have ${monitorCount} monitors connected. For security purposes, please disconnect all additional monitors. Only a single display is permitted during this assessment.`}
        childrenNode={
          <div className="text-sm font-semibold text-muted-foreground mt-4 text-center">
            The assessment will automatically unlock when additional monitors are disconnected.
          </div>
        }
      />
    );
  }

  return <>{children}</>;
};

export default MultiMonitorDetector;
