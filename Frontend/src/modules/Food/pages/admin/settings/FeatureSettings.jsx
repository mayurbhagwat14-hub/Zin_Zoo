import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@food/components/ui/card';
import { Button } from '@food/components/ui/button';
import { Switch } from '@food/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

const FEATURE_KEYS = {
    RESTAURANT_SUBSCRIPTION: 'restaurant_subscription',
    COD_CONTROL: 'cod_control',
    WALLET_CONTROL: 'wallet_control',
    ADMIN_ACCESS_SECTION: 'admin_access_section',
    ROOT_LANDING_AND_UNREGISTERED_CONTROL: 'root_landing_and_unregistered_control'
};

export default function FeatureSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingKey, setSavingKey] = useState(null);
    const [features, setFeatures] = useState([]);

    const restaurantSubscription = useMemo(
        () => features.find((item) => item.key === FEATURE_KEYS.RESTAURANT_SUBSCRIPTION) || null,
        [features]
    );

    const codControl = useMemo(
        () => features.find((item) => item.key === FEATURE_KEYS.COD_CONTROL) || null,
        [features]
    );

    const walletControl = useMemo(
        () => features.find((item) => item.key === FEATURE_KEYS.WALLET_CONTROL) || null,
        [features]
    );

    const adminAccessSection = useMemo(
        () => features.find((item) => item.key === FEATURE_KEYS.ADMIN_ACCESS_SECTION) || null,
        [features]
    );

    const rootLandingAndUnregisteredControl = useMemo(
        () => features.find((item) => item.key === FEATURE_KEYS.ROOT_LANDING_AND_UNREGISTERED_CONTROL) || null,
        [features]
    );

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const res = await adminAPI.getFeatureSettings();
                const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
                setFeatures(rows);
            } catch (error) {
                toast.error('Failed to load feature settings.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const setToggle = async (key, checked) => {
        const nextEnabled = Boolean(checked);
        const previousFeatures = features;
        setFeatures((prev) => {
            const exists = prev.some((row) => row.key === key);
            if (!exists) {
                return [...prev, { key, isEnabled: nextEnabled }];
            }
            return prev.map((row) =>
                row.key === key ? { ...row, isEnabled: nextEnabled } : row
            );
        });

        try {
            setSavingKey(key);
            const res = await adminAPI.updateFeatureSetting(key, { isEnabled: nextEnabled });
            const savedRow = res?.data?.data;
            if (savedRow?.key) {
                setFeatures((prev) =>
                    prev.map((row) => (row.key === savedRow.key ? { ...row, ...savedRow } : row))
                );
            }
            window.dispatchEvent(new CustomEvent('adminFeatureSettingUpdated', {
                detail: { key, isEnabled: nextEnabled }
            }));
            toast.success(`${savedRow?.name || 'Feature setting'} ${nextEnabled ? 'enabled' : 'disabled'}.`);
        } catch (error) {
            setFeatures(previousFeatures);
            toast.error(error?.response?.data?.message || 'Failed to update feature setting.');
        } finally {
            setSavingKey(null);
        }
    };

    const handleSave = async () => {
        const updates = [restaurantSubscription, codControl, walletControl, adminAccessSection, rootLandingAndUnregisteredControl].filter(Boolean);
        if (updates.length === 0) return;
        try {
            setSaving(true);
            await Promise.all(
                updates.map((feature) =>
                    adminAPI.updateFeatureSetting(feature.key, {
                        isEnabled: Boolean(feature.isEnabled)
                    })
                )
            );
            updates.forEach((feature) => {
                window.dispatchEvent(new CustomEvent('adminFeatureSettingUpdated', {
                    detail: {
                        key: feature.key,
                        isEnabled: Boolean(feature.isEnabled)
                    }
                }));
            });
            toast.success('Feature setting updated successfully.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to update feature setting.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[320px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Feature Settings</h1>
                <p className="text-sm text-gray-500 mt-1">Enable or disable platform features safely from one place.</p>
            </div>

            {/* Commented out as subscription flow is not currently needed
            {restaurantSubscription && (
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Restaurant Subscription</CardTitle>
                        <CardDescription>
                            Controls restaurant onboarding payment, subscription dues checks, and subscription settings UI.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-4">
                        <div className="text-sm text-slate-700 dark:text-gray-300">
                            {restaurantSubscription.isEnabled
                                ? 'Enabled: Restaurant subscription is active'
                                : 'Disabled: Restaurant subscription is inactive'}
                        </div>
                        <Switch
                            checked={Boolean(restaurantSubscription.isEnabled)}
                            onCheckedChange={(checked) => setToggle(FEATURE_KEYS.RESTAURANT_SUBSCRIPTION, checked)}
                        />
                    </CardContent>
                </Card>
            )}
            */}

            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg">Cash On Delivery (COD)</CardTitle>
                    <CardDescription>
                        Controls COD visibility on user checkout and delivery cash-limit related sections in delivery/admin panels.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                    <div className="text-sm text-gray-700">
                        {codControl?.isEnabled
                            ? 'Enabled: COD and cash-limit sections are visible'
                            : 'Disabled: COD and cash-limit sections are hidden'}
                    </div>
                    <Switch
                        checked={Boolean(codControl?.isEnabled)}
                        disabled={savingKey === FEATURE_KEYS.COD_CONTROL}
                        onCheckedChange={(checked) => setToggle(FEATURE_KEYS.COD_CONTROL, checked)}
                    />
                </CardContent>
            </Card>

            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg">Zinzoo Wallet Payment</CardTitle>
                    <CardDescription>
                        Controls Zinzoo Wallet payment option visibility and usage at user checkout.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                    <div className="text-sm text-gray-700">
                        {walletControl?.isEnabled
                            ? 'Enabled: Zinzoo Wallet payment option is visible at checkout'
                            : 'Disabled: Zinzoo Wallet payment option is hidden at checkout'}
                    </div>
                    <Switch
                        checked={Boolean(walletControl?.isEnabled)}
                        disabled={savingKey === FEATURE_KEYS.WALLET_CONTROL}
                        onCheckedChange={(checked) => setToggle(FEATURE_KEYS.WALLET_CONTROL, checked)}
                    />
                </CardContent>
            </Card>

            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg">Admin Access Section</CardTitle>
                    <CardDescription>
                        Controls visibility of the Admin Access sidebar section, including Sub Admin List.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                    <div className="text-sm text-gray-700">
                        {adminAccessSection?.isEnabled
                            ? 'Enabled: Admin Access section is visible'
                            : 'Disabled: Admin Access section is hidden'}
                    </div>
                    <Switch
                        checked={Boolean(adminAccessSection?.isEnabled)}
                        disabled={savingKey === FEATURE_KEYS.ADMIN_ACCESS_SECTION}
                        onCheckedChange={(checked) => setToggle(FEATURE_KEYS.ADMIN_ACCESS_SECTION, checked)}
                    />
                </CardContent>
            </Card>

            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg">Root Landing & Unregistered Restaurants</CardTitle>
                    <CardDescription>
                        Controls root URL and Unregistered Restaurants visibility. OFF redirects root (/) to /food/user and hides Unregistered Restaurants.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                    <div className="text-sm text-gray-700">
                        {rootLandingAndUnregisteredControl?.isEnabled
                            ? 'Enabled: root opens Landing Page and Unregistered Restaurants is visible'
                            : 'Disabled: root redirects to /food/user and Unregistered Restaurants is hidden'}
                    </div>
                    <Switch
                        checked={Boolean(rootLandingAndUnregisteredControl?.isEnabled)}
                        disabled={savingKey === FEATURE_KEYS.ROOT_LANDING_AND_UNREGISTERED_CONTROL}
                        onCheckedChange={(checked) => setToggle(FEATURE_KEYS.ROOT_LANDING_AND_UNREGISTERED_CONTROL, checked)}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving || (!restaurantSubscription && !codControl && !walletControl && !adminAccessSection && !rootLandingAndUnregisteredControl)}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}
