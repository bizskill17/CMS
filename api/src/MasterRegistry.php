<?php

declare(strict_types=1);

namespace App;

final class MasterRegistry
{
    public static function all(): array
    {
        $resources = [
            'organizations' => [
                'table' => 'organizations',
                'select' => 'o.id, o.organization_code, o.organization_name, s.gst, s.address, s.logo, o.is_active, o.created_at',
                'from' => 'organizations o left join settings s on s.organization_id = o.id',
                'order_by' => 'o.id desc',
                'search_columns' => ['o.organization_code', 'o.organization_name', 's.gst', 's.address'],
                'write_columns' => ['organization_code', 'organization_name', 'gst', 'address', 'logo', 'is_active'],
                'required' => ['organization_code', 'organization_name'],
                'nullable' => ['gst', 'address', 'logo'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['organization_code'], 'label' => 'Organization Code', 'display_column' => 'organization_code'],
                    ['columns' => ['organization_name'], 'label' => 'Organization Name', 'display_column' => 'organization_name'],
                ],
                'organization_owned' => false,
                'file_columns' => ['logo'],
            ],
            'customers' => [
                'table' => 'customers',
                'select' => 'c.id, c.full_name, c.mobile, c.alternate_mobile, c.email, c.address_line_1, c.city, c.state, c.gstin, c.notes, c.is_active, c.created_at',
                'from' => 'customers c',
                'order_by' => 'c.id desc',
                'search_columns' => ['c.full_name', 'c.mobile', 'c.email', 'c.address_line_1', 'c.city', 'c.state', 'c.gstin'],
                'write_columns' => [
                    'full_name',
                    'mobile',
                    'alternate_mobile',
                    'email',
                    'date_of_birth',
                    'anniversary_date',
                    'pan',
                    'aadhaar',
                    'gstin',
                    'father_name',
                    'address_line_1',
                    'address_line_2',
                    'address_line_3',
                    'city',
                    'state',
                    'pincode',
                    'is_active',
                    'notes'
                ],
                'required' => ['full_name'],
                'nullable' => [
                    'alternate_mobile',
                    'email',
                    'date_of_birth',
                    'anniversary_date',
                    'pan',
                    'aadhaar',
                    'gstin',
                    'father_name',
                    'address_line_1',
                    'address_line_2',
                    'address_line_3',
                    'city',
                    'state',
                    'pincode',
                    'notes'
                ],
                'boolean' => ['is_active'],
                'organization_scope_column' => 'c.organization_id',
            ],
            'states' => [
                'table' => 'states',
                'select' => 's.id, s.state_name, s.state_code, s.is_active, s.created_at',
                'from' => 'states s',
                'order_by' => 's.state_name asc',
                'write_columns' => ['state_name', 'state_code', 'is_active'],
                'required' => ['state_name'],
                'nullable' => ['state_code'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['state_name'], 'label' => 'State Name', 'display_column' => 'state_name'],
                ],
                'organization_scope_column' => 's.organization_id',
            ],
            'cities' => [
                'table' => 'cities',
                'select' => 'c.id, c.city_name, c.city_code, c.state_id, s.state_name, c.is_active, c.created_at',
                'from' => 'cities c left join states s on s.id = c.state_id',
                'order_by' => 's.state_name asc, c.city_name asc',
                'write_columns' => ['state_id', 'city_name', 'city_code', 'is_active'],
                'required' => ['state_id', 'city_name'],
                'nullable' => ['city_code'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['state_id', 'city_name'], 'label' => 'City Name', 'display_column' => 'city_name'],
                ],
                'organization_scope_column' => 'c.organization_id',
            ],
            'product-categories' => [
                'table' => 'product_categories',
                'select' => 'pc.id, pc.category_name, pc.is_active, pc.created_at',
                'from' => 'product_categories pc',
                'order_by' => 'pc.category_name asc',
                'write_columns' => ['category_name', 'is_active'],
                'required' => ['category_name'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['category_name'], 'label' => 'Category Name', 'display_column' => 'category_name'],
                ],
                'organization_scope_column' => 'pc.organization_id',
            ],
            'users' => [
                'table' => 'users',
                'select' => 'u.id, u.full_name, u.login_id, u.password, u.views, u.email, u.mobile, u.role_name, u.is_active, u.created_at',
                'from' => 'users u',
                'order_by' => 'u.id desc',
                'write_columns' => ['full_name', 'login_id', 'password', 'views', 'email', 'mobile', 'role_name', 'notes', 'is_active'],
                'required' => ['full_name', 'login_id', 'password', 'views', 'role_name'],
                'nullable' => ['email', 'mobile', 'notes'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['login_id'], 'label' => 'Log In Id', 'display_column' => 'login_id'],
                    ['columns' => ['email'], 'label' => 'Email', 'display_column' => 'email'],
                ],
                'organization_scope_column' => 'u.organization_id',
            ],
        ];

        foreach ($resources as $key => $config) {
            if (!array_key_exists('organization_owned', $config)) {
                $resources[$key]['organization_owned'] = true;
            }
        }

        return $resources;
    }
}
