import React from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '../ui/button'
import { PageContainer } from '../layout/page-container'

type Props = {}

const AdminDashboard = (props: Props) => {
  return (
    <PageContainer>
        <h1>Admin Dashboard</h1>
    </PageContainer>
  )
}

export default AdminDashboard